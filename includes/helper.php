<?php
/*
 * Version: 1.6
 * Author: Alex Polonski
 * Author URI: http://smartcalc.es/wp
 * License: GPL2
 */
defined( 'ABSPATH' ) or die();
class SmartCountdownEasyRecurring_Helper {
	public static function selectInput( $id, $name, $selected = '', $config = array() ) {
		$config = array_merge( array(
				'type' => 'integer',
				'start' => 1,
				'end' => 10,
				'step' => 1,
				'default' => 0,
				'padding' => 2,
				'class' => '' 
		), $config );
		
		if( !empty( $config['class'] ) ) {
			$config['class'] = ' class="' . $config['class'] . '"';
		}
		$html = array();
		
		if( $config['type'] == 'integer' ) {
			$html[] = '<select id="' . $id . '" name="' . $name . '"' . $config['class'] . '>';
			
			for( $v = $config['start']; $v <= $config['end']; $v += $config['step'] ) {
				$padded = str_pad( $v, $config['padding'], '0', STR_PAD_LEFT );
				$html[] = '<option value="' . $padded . '"' . ( intval( $selected ) == intval( $v ) ? ' selected' : '' ) . '>' . $padded . '</option>';
			}
		} elseif( $config['type'] == 'optgroups' ) {
			// plain lists and option groups supported
			$html[] = '<select id="' . $id . '" name="' . $name . '"' . $config['class'] . '>';
			
			foreach( $config['options'] as $value => $option ) {
				if( is_array( $option ) ) {
					// this is an option group
					$html[] = '<optgroup label="' . esc_html( $value ) . '">';
					foreach( $option as $v => $text ) {
						$html[] = '<option value="' . $v . '"' . ( $v == $selected ? ' selected' : '' ) . '>';
						$html[] = esc_html( $text );
						$html[] = '</option>';
					}
					$html[] = '</optgroup>';
				} else {
					// this is a plain select option
					$html[] = '<option value="' . $value . '"' . ( $value == $selected ? ' selected' : '' ) . '>';
					$html[] = esc_html( $option );
					$html[] = '</option>';
				}
			}
		}
		
		$html[] = '</select>';
		
		return implode( "\n", $html );
	}
	public static function checkboxesInput( $id, $name, $values, $config = array() ) {
		$html = array();
		if( !empty( $config['legend'] ) ) {
			$html[] = '<fieldset><legend>' . $config['legend'] . '</legend>';
		}
		foreach( $config['options'] as $value => $text ) {
			$field_id = $id . $value;
			$field_name = $name . '[' . $value . ']';
			$html[] = '<input type="checkbox" class="checkbox" id="' . $field_id . '" name="' . $field_name . '"' . ( !empty( $values[$value] ) && $values[$value] == 'on' ? ' checked' : '' ) . ' />';
			$html[] = '<label for="' . $field_id . '">' . esc_attr( $text );
			$html[] = '</label>&nbsp;';
		}
		if( !empty( $config['legend'] ) ) {
			$html[] = '</fieldset>';
		}
		return implode( "\n", $html );
	}
	public static function getEvents( $instance, $configs ) {
		if( empty( $configs ) ) {
			return $instance;
		}
		
		$imported = array();
		// get current local time. We will calculate recurring basing on local time
		// and later convert results to UTC
		$now = new DateTime( current_time( 'mysql', false ) );
		
		foreach( $configs as $config ) {
			if( empty( $config['pattern'] ) ) {
				continue;
			}
			
			// if this plugin is used with old version of Smart Countdown FX we presume that
			// countdown_to_end mode is always OFF
			$countdown_to_end = !empty( $instance['countdown_to_end'] ) ? true : false;
			
			$duration = 0;
			if( !empty( $config['duration'] ) ) {
				$hm = explode( ':', $config['duration'] );
				if( count( $hm ) == 2 ) {
					$duration = ( int ) $hm[0] * 3600 + ( int ) $hm[1] * 60;
					if( $duration < 0 ) {
						$duration = 0;
					}
				}
			}
			
			if( $config['pattern'] == 'daily' ) {
				self::addEasyRecurrenceChain( $imported, 'day', $duration, $countdown_to_end, $config );
			} elseif( $config['pattern'] == 'weekly' ) {
				self::addEasyRecurrenceChain( $imported, 'weekday', $duration, $countdown_to_end, $config );
			} elseif( $config['pattern'] == 'monthly' ) {
				self::addEasyRecurrenceChain( $imported, 'month', $duration, $countdown_to_end, $config );
			} elseif( $config['pattern'] == 'nthweekday' ) {
				self::addEasyRecurrenceChain( $imported, 'nthweekday', $duration, $countdown_to_end, $config );
			} else { // yearly
				self::addEasyRecurrenceChain( $imported, 'year', $duration, $countdown_to_end, $config );
			}
		}
		
		if( !isset( $instance['imported'] ) ) {
			$instance['imported'] = array();
		}
		
		$instance['imported'][SmartCountdownEasyRecurrence_Plugin::$provider_alias] = $imported;
		
		return $instance;
	}
	private static function addEasyRecurrenceChain( &$imported, $unit, $duration, $countdown_to_end, $recurrence_config = array(), $base_date = null ) {
		$base_date = is_null( $base_date ) ? new DateTime( current_time( 'mysql', false ) ) : $base_date;
		
		$recurrence_config = array_merge( array(
				'hour' => '00',
				'minute' => '00',
				'date' => '01',
				'month' => '01',
				'weekdays' => array(),
				'nthocurrence' => 0,
				'nthweekday' => 1 
		), $recurrence_config );
		
		$hour = str_pad( $recurrence_config['hour'], 2, '0', STR_PAD_LEFT );
		$minute = str_pad( $recurrence_config['minute'], 2, '0', STR_PAD_LEFT );
		$month = str_pad( $recurrence_config['month'], 2, '0', STR_PAD_LEFT );
		$date = str_pad( $recurrence_config['date'], 2, '0', STR_PAD_LEFT );
		
		try {
			if( $unit == 'day' || $unit == 'week' ) {
				$base_date = new DateTime( $base_date->format( 'Y-m-d ' . $hour . ':' . $minute . ':00' ) );
			} elseif( $unit == 'month' ) {
				// if date string is not valid it will be corrected later
				$base_date = new DateTime( $base_date->format( 'Y-m-' . $date . ' ' . $hour . ':' . $minute . ':00' ) );
			} elseif( $unit == 'year' ) {
				// if date string is not valid it will be corrected later
				$base_date = new DateTime( $base_date->format( 'Y-' . $month . '-' . $date . ' ' . $hour . ':' . $minute . ':00' ) );
			} elseif( $unit == 'nthweekday' ) {
				// monthly by weekday - very special case
				
				// this recurrence pattern produces dates with unequal intervals, so we cannot
				// use a simple "modify +1 unit" loop - we use custom recurrence dates
				$recurrence_dates = array();
				
				// get first day of current month
				$this_month_start = new DateTime( $base_date->format( 'Y-m-01 00:00:00' ) );
				
				// get correct recurrence day for each month -1 ... +2
				for( $month_delta = -1; $month_delta <= 2; $month_delta++ ) {
					$tmp = clone ( $this_month_start );
					$diff = $month_delta >= 0 ? '+' . $month_delta : $month_delta;
					$tmp->modify( $diff . ' month' );
					$recurrence_dates[] = self::findDateByWeekdayInMonth( $tmp, $recurrence_config['nthocurrence'], $recurrence_config['nthweekday'] );
				}
				
				// add events to timeline
				foreach( $recurrence_dates as $day_start ) {
					$base = new DateTime( $day_start . ' ' . $hour . ':' . $minute . ':00' );
					$tmp = clone ( $base );
					$imported[] = array(
							'deadline' => self::dateToUTC( $tmp ),
							'is_countdown_to_end' => 0,
							'duration' => $countdown_to_end ? 0 : $duration,
							'title' => '',
							'dbg_date' => $tmp->format( 'Y-m-d H:i:s' ) 
					);
					if( $countdown_to_end && $duration > 0 ) {
						$tmp = clone ( $base );
						$tmp->modify( '+' . $duration . ' second' );
						$imported[] = array(
								'deadline' => self::dateToUTC( $tmp ),
								'is_countdown_to_end' => 1,
								'duration' => 0,
								'title' => '',
								'dbg_date' => $tmp->format( 'Y-m-d H:i:s' ) 
						);
					}
				}
				
				// we are done
				return;
			} else {
				// weekdays - special case
				if( empty( $recurrence_config['weekdays'] ) ) {
					return;
				}
				$today_weekday = $base_date->format( 'w' );
				$recurrence_days = array_keys( $recurrence_config['weekdays'] );
				
				// Make sure that weekdays are sorted ASC
				sort( $recurrence_days );
				
				// For weekly pattern we have to add events for today (if today weekday is
				// in $recurrence_days array) and also for the closest previous and next weekdays
				$base_dates = array();
				
				$base_date = new DateTime( $base_date->format( 'Y-m-d ' . $hour . ':' . $minute . ':00' ) );
				
				if( in_array( $today_weekday, $recurrence_days ) ) {
					// add today
					$this_day = clone ( $base_date );
					$base_dates[] = $this_day;
				}
				
				for( $i = 1; $i < 7; $i++ ) {
					// look for the closest weekday in future
					$weekday = ( $today_weekday + $i ) % 7;
					if( in_array( $weekday, $recurrence_days ) ) {
						$next_day = clone ( $base_date );
						$next_day->modify( '+' . $i . ' day' );
						$base_dates[] = $next_day;
						break;
					}
				}
				for( $i = 1; $i < 7; $i++ ) {
					// look for the closest weekday in past
					$weekday = $today_weekday - $i < 0 ? $today_weekday - $i + 7 : $today_weekday - $i;
					if( in_array( $weekday, $recurrence_days ) ) {
						$prev_day = clone ( $base_date );
						$prev_day->modify( '-' . $i . ' day' );
						$base_dates[] = $prev_day;
						break;
					}
				}
				// add all events as plain weekly recurrence
				foreach( $base_dates as $anchor ) {
					self::addEasyRecurrenceChain( $imported, 'week', $duration, $countdown_to_end, $recurrence_config, $anchor );
				}
				return;
			}
		} catch( Exception $e ) {
			return;
		}
		
		for( $delta = -1; $delta <= 2; $delta++ ) {
			$tmp = clone ( $base_date );
			$diff = $delta >= 0 ? '+' . $delta : $delta;
			$tmp->modify( $diff . ' ' . $unit );
			
			// for monthly and yearly recurrence we check if requested date exists
			// in month. If not we replace it with the last day of month
			if( $unit == 'month' || $unit == 'year' ) {
				if( intval( $date ) != intval( $tmp->format( 'd' ) ) ) {
					$tmp->modify( '-1 month' );
					$tmp = new DateTime( $tmp->format( 'Y-m-t H:i:s' ) );
				}
			}
			
			// in "countdown to end" mode we convert each event with duration
			// into 2 events with duration zero, the second one marked as
			// 'is_countdown_to_end', so that the widget knows which event titles
			// to use with it (titles for up mode should be displayed when counting
			// down to event end time)
			$imported[] = array(
					'deadline' => self::dateToUTC( $tmp ),
					'is_countdown_to_end' => 0,
					'duration' => $countdown_to_end ? 0 : $duration,
					'title' => '',
					'dbg_date' => $tmp->format( 'Y-m-d H:i:s' ) 
			);
			if( $countdown_to_end && $duration > 0 ) {
				$tmp->modify( '+' . $duration . ' second' );
				$imported[] = array(
						'deadline' => self::dateToUTC( $tmp ),
						'is_countdown_to_end' => 1,
						'duration' => 0,
						'title' => '',
						'dbg_date' => $tmp->format( 'Y-m-d H:i:s' ) 
				);
			}
		}
	}
	
	/**
	 * Get the date of n-th ocurrence of a given weekday in a month
	 *
	 * @param DateTime $month_start
	 *        	- first day of month
	 * @param int $nthocurrence
	 *        	- zero-based index (0 -> first ocurrence, 1 -> second ocurrence and so on,
	 *        	4 -> will always give the last ocurrence in a month)
	 * @param int $weekday
	 *        	- weekday index as returned by 'w' date format
	 * @return string - literal date in format Y-m-d
	 */
	private static function findDateByWeekdayInMonth( $month_start, $nthocurrence, $weekday ) {
		$month_start_weekday = $month_start->format( 'w' );
		// calculate the first ocurrence of $weekday in month
		$weekday_date_1st = ( $weekday - $month_start_weekday + 7 ) % 7 + 1;
		
		// we know that a week day has at least 4 ocurrences and at most 5 ocurrences in any month
		// that is why adding zero-based week difference to the first ocurrence of a day in a month
		// will still result in a date within the same month if the diff is < 4.
		// If diff = 4 (maximum allowed value) and we get resulting date in next month we can be sure
		// that substracting 1 week we get back to correct month
		
		// advance by $nthweek to the future
		$base = new DateTime( $month_start->format( 'Y-m-' . $weekday_date_1st . ' 00:00:00' ) );
		$base->modify( '+' . $nthocurrence . ' week' );
		
		// rollback the last increment if we have landed in the next month (overflow)
		/* while */
		if( $base->format( 'm' ) != $month_start->format( 'm' ) ) {
			$base->modify( '-1 week' );
		}
		return $base->format( 'Y-m-d' );
	}
	private static $utcOffset = null;
	private static $timeZone = null;
	private static function dateToUTC( $date ) {
		if( $date instanceof DateTime ) {
			// do not modify $date, work with a clone copy
			$result = clone( $date );
		} else {
			$result = new DateTime( $date );
		}
		
		if( !is_null( self::$utcOffset ) ) {
			// we have fixed offset stored - use it
			$offset = self::$utcOffset;
		} else {
			if( is_null( self::$timeZone ) ) {
				// time zone object is not yet cached
				$tz_string = get_option( 'timezone_string', 'UTC' );
				if( empty( $tz_string ) ) {
					// direct offset if not a TZ, cache fixed offset
					$offset = self::$utcOffset = get_option( 'gmt_offset' ) * 3600;
				} else {
					try {
						self::$timeZone = new DateTimeZone( $tz_string );
						$offset = self::$timeZone->getOffset( $result );
					} catch( Exception $e ) { // invalid timezone string
						self::$timeZone = null;
						$offset = self::$utcOffset = 0;
					}
				}
			} else {
				// time zone obect is cached - use it to get offset for the given date
				$offset = self::$timeZone->getOffset( $result );
			}
		}
		// apply calculated offset
		$result->modify( ( $offset < 0 ? '+' : '-' ) . abs( $offset ) . ' second' );
		
		return $result->format( 'Y-m-d H:i:s' );
	}
}