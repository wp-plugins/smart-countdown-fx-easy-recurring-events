<?php
/*
Version: 1.0.1
Author: Alex Polonski
Author URI: http://smartcalc.es/wp
License: GPL2
*/

defined( 'ABSPATH' ) or die();

class SmartCountdownEasyRecurring_Helper {
	public static function selectInput( $id, $name, $selected = '', $config = array() ) {
		$config = array_merge( array (
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
		$html = array ();
		
		if ( $config ['type'] == 'integer' ) {
			$html [] = '<select id="' . $id . '" name="' . $name . '"' . $config['class'] . '>';
			
			for ( $v = $config ['start']; $v <= $config ['end']; $v += $config ['step'] ) {
				$html [] = '<option value="' . $v . '"' . ( $selected == $v ? ' selected' : '' ) . '>' . str_pad( $v, $config['padding'], '0', STR_PAD_LEFT ) . '</option>';
			}
		} elseif ( $config ['type'] == 'optgroups' ) {
			// plain lists and option groups supported
			$html [] = '<select id="' . $id . '" name="' . $name . '"' . $config['class'] . '>';
			
			foreach ( $config ['options'] as $value => $option ) {
				if ( is_array( $option ) ) {
					// this is an option group
					$html [] = '<optgroup label="' . esc_html( $value ) . '">';
					foreach ( $option as $v => $text ) {
						$html [] = '<option value="' . $v . '"' . ( $v == $selected ? ' selected' : '' ) . '>';
						$html [] = esc_html( $text );
						$html [] = '</option>';
					}
					$html [] = '</optgroup>';
				} else {
					// this is a plain select option
					$html [] = '<option value="' . $value . '"' . ( $value == $selected ? ' selected' : '' ) . '>';
					$html [] = esc_html( $option );
					$html [] = '</option>';
				}
			}
		}
		
		$html [] = '</select>';
		
		return implode( "\n", $html );
	}
	public static function checkboxesInput( $id, $name, $values, $config = array() ) {
		$html = array ();
		if ( !empty( $config ['legend'] ) ) {
			$html [] = '<fieldset><legend>' . $config ['legend'] . '</legend>';
		}
		foreach ( $config['options'] as $value => $text ) {
			$field_id = $id . $value;
			$field_name = $name . '[' . $value . ']';
			$html [] = '<input type="checkbox" class="checkbox" id="' . $field_id . '" name="' . $field_name . '"' . ( !empty( $values[$value] ) && $values[$value] == 'on'  ? ' checked' : '' ) . ' />';
			$html [] = '<label for="' . $field_id . '">' . esc_attr($text);
			$html [] = '</label>&nbsp;';
		}
		if ( !empty( $config ['legend'] ) ) {
			$html [] = '</fieldset>';
		}
		return implode( "\n", $html );
	}
	
	public static function getEvents( $instance, $configs ) {
		if( empty( $configs ) ) {
			return $instacne;
		}
		
		$imported = array();
		// get current local time. We will calculate recurring basing on local time
		// and later convert results to UTC
		$now = new DateTime(current_time( 'mysql', false ));
		
		foreach( $configs as $config ) {
			if( empty( $config['pattern'] ) ) {
				continue;
			}
			
			if( $config['pattern'] == 'daily' ) {
				self::addEasyRecurrenceChain( $imported, 'day', $config['hour'], $config['minute'] );
			} elseif( $config['pattern'] == 'weekly' ) {
				self::addEasyRecurrenceChain( $imported, 'weekday', $config['hour'], $config['minute'], null, null, $config['weekdays'] );
			} elseif( $config['pattern'] == 'monthly' ) {
				self::addEasyRecurrenceChain( $imported, 'month', $config['hour'], $config['minute'], $config['date'] );
			} else {
				// yearly
				self::addEasyRecurrenceChain( $imported, 'year', $config['hour'], $config['minute'], $config['date'], $config['month'] );
			}
			
		}
		
		if( !isset( $instance['imported'] ) ) {
			$instance['imported'] = array();
		}
	
		$instance['imported'][SmartCountdownEasyRecurrence_Plugin::$provider_alias] = $imported;
	
		return $instance;
	}
	
	private static function addEasyRecurrenceChain( &$imported, $unit, $hour, $minute, $date = '', $month = '', $weekdays = array(), $base_date = null ) {
		$base_date = is_null( $base_date ) ? new DateTime(current_time( 'mysql', false ) ) : $base_date;
		
		$hour = str_pad( $hour, 2, '0', STR_PAD_LEFT );
		$minute = str_pad( $minute, 2, '0', STR_PAD_LEFT );
		$month = str_pad( $month, 2, '0', STR_PAD_LEFT );
		
		try {
			if( $unit == 'day' || $unit == 'week' ) {
				$base_date = new DateTime( $base_date->format( 'Y-m-d ' . $hour . ':' . $minute . ':00' ) );
			} elseif( $unit == 'month' ) {
				$base_date = new DateTime( $base_date->format( 'Y-m-' . $date . ' ' . $hour . ':' . $minute . ':00' ) );
			} elseif( $unit == 'year' ) {
				$base_date = new DateTime( $base_date->format( 'Y-' . $month . '-' . $date . ' ' . $hour . ':' . $minute . ':00' ) );
			} else {
				// weekdays - special case
				if( empty( $weekdays ) ) {
					return;
				}
				$today_weekday = $base_date->format( 'w' );
				$recurrence_days = array_keys( $weekdays );
				
				// Make sure that weekdays are sorted ASC
				sort( $recurrence_days );
				
				// For weekly pattern we have to add events for today (if today weekday is
				// in $recurrence_days array) and also for the closest previous and next weekdays
				$base_dates = array();
				
				$base_date = new DateTime( $base_date->format( 'Y-m-d ' . $hour . ':' . $minute . ':00' ) );
				
				if( in_array( $today_weekday, $recurrence_days ) ) {
					// add today
					$this_day = clone( $base_date );
					$base_dates[] = $this_day;
				}
				
				for( $i = 1; $i < 7; $i++ ) {
					// look for the closest weekday in future
					$weekday = ( $today_weekday + $i ) % 7;
					if( in_array( $weekday, $recurrence_days ) ) {
						$next_day = clone( $base_date );
						$next_day->modify( '+' . $i . ' day' );
						$base_dates[] = $next_day;
						break;
					}
				}
				for( $i = 1; $i < 7; $i++ ) {
					// look for the closest weekday in past
					$weekday =  $today_weekday - $i  < 0 ? $today_weekday - $i + 7 : $today_weekday - $i;
					if( in_array( $weekday, $recurrence_days ) ) {
						$prev_day = clone( $base_date );
						$prev_day->modify( '-' . $i . ' day' );
						$base_dates[] = $prev_day;
						break;
					}
				}
				// add all events as plain weekly recurrence
				foreach( $base_dates as $anchor ) {
					self::addEasyRecurrenceChain( $imported, 'week', $hour, $minute, null, null, null, $anchor );
				}
				return;
			}
		} catch( Exception $e ) {
			return;
		}
		
		$current_date = clone( $base_date );
		
		$prev_date = clone( $base_date );
		$prev_date->modify( '-1 ' . $unit );
		$next_date = clone ( $base_date );
		$next_date->modify( '+1 ' . $unit );
		$postnext_date = clone( $base_date );
		$postnext_date->modify( '+2 ' . $unit );
		
		$imported[] = array(
				'deadline' => self::dateToUTC( $prev_date ),
				'title' => '',
				'duration' => 0
		);
		$imported[] = array(
				'deadline' => self::dateToUTC( $current_date ),
				'title' => '',
				'duration' => 0
		);
		$imported[] = array(
				'deadline' => self::dateToUTC( $next_date ),
				'title' => '',
				'duration' => 0
		);
		$imported[] = array(
				'deadline' => self::dateToUTC( $postnext_date ),
				'title' => '',
				'duration' => 0
		);
	}
	
	private static function dateToUTC( $date ) {
		if( $date instanceof DateTime ) {
			$result = $date;
		} else {
			$result = new DateTime( $date/*, new DateTimeZone('UTC')*/ );
		}
		
		// For now we use current WP system time (aware of time zone in settings)
		$tz_string = get_option( 'timezone_string', 'UTC' );
		if( empty( $tz_string ) ) {
			// direct offset if not a TZ
			$offset = get_option( 'gmt_offset' ) * 3600;
		} else {
			try {
				$tz = new DateTimeZone( $tz_string );
				$offset = $tz->getOffset( $result );
			} catch( Exception $e ) {
				$offset = 0; // invalid timezone string
			}
		}
		$result->modify( ($offset < 0 ? '+' : '-') . abs( $offset ) . ' second' );
		
		return $result->format( 'Y-m-d H:i:s' );
	}
}