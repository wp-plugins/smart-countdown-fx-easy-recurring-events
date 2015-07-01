(function($) {
	const MILIS_IN_DAY = 86400000;
	const MILIS_IN_HOUR = 3600000;
	const MILIS_IN_MINUTE = 60000;
	const MILIS_IN_SECOND = 1000;
	
	const SECONDS_IN_DAY = 86400;
	const SECONDS_IN_HOUR = 3600;
	const SECONDS_IN_MINUTE = 60;
	const MINUTES_IN_DAY = SECONDS_IN_DAY / 60;
	const MINUTES_IN_HOUR = 60;
	const HOURS_IN_DAY = 24;
	const MONTHS_IN_YEAR = 12;
	
	const MIN_SUSPEND_THRESHOLD = 500; // standard threshold
	const SUSPEND_THRESHOLD_RELAX_STEP = 2000; // temporarly increment threshold by this value
	const SUSPEND_THRESHOLD_RESTRICT_STEP = 250; // gradually decrease threshold by this value
	
	// global container for smart countdown objects
	scds_container = {
		timer : false,
		instances : {},
		add : function(options) {
			// scd_counter is a generic object. We have to use a fresh copy
			// each time we add a counter, so that scd_counter instance is
			// always intact.
			var working_copy = $.extend(true, {}, scd_counter);
			
			// call init method. Depending on the counter type - widget or
			// embedded with a shortcode, the recently created counter will
			// be added to scds_container after it's setup is complete
			working_copy.init(options);
			
			// create the tick timer if not created yet
			if(this.timer === false) {
				this.timer = window.setInterval(function() {
					scds_container.fireAllCounters();
				}, MILIS_IN_SECOND);
				// avoid massive resize events
				$(window).resize(function() {
					clearTimeout($.data(this, 'resizeTimer'));
					$.data(this, 'resizeTimer', setTimeout(function() {
						scds_container.responsiveAdjust();
					}, 100));
				});
			}
		},
		remove : function(id) {
			delete(scds_container.instances[id]);
		},
		updateInstance : function(id, instance) {
			scds_container.instances[id] = instance;
			scds_container.responsiveAdjust();
		},
		fireAllCounters : function() {
			$.each(this.instances, function() {
				this.tick(true);
			});
		},
		responsiveAdjust : function() {
			$.each(this.instances, function(id, counter) {
				var width = window.innerWidth
					|| document.documentElement.clientWidth
					|| document.body.clientWidth;
				counter.responsiveAdjust(width);
			});
		}
	}
	
	var scd_counter = {
		options : {
			now : null,
			units : {
				years : 1,
				months : 1,
				weeks : 1,
				days : 1,
				hours : 1,
				minutes : 1,
				seconds : 1
			},
			hide_lower_units : [],
			limits : {
				// default overflow limits for up mode. If some of related time units
				// are not displayed these limits will be updated in getCounterValues()
				seconds : SECONDS_IN_HOUR,
				minutes : MINUTES_IN_HOUR,
				hours : HOURS_IN_DAY
			},
			paddings : {
				years : 1,
				months : 1,
				weeks : 1,
				days : 2,
				hours : 2,
				minutes : 2,
				seconds : 2
			},
			animations : {},
			labels_vert_align : 'middle',
			initDisplay : true,
			allow_lowest_zero : 0,
			replace_lowest_zero : 1,
			hide_highest_zeros : 0,
			hide_countup_counter : 0,
			shortcode : 0,
			redirect_url : '',
			click_url : '',
			import_config : '',
			base_font_size : 12
		},
		current_values : {},
		elements : {},
		awake_detect : 0,
		acc_correction : 0,
		SUSPEND_THRESHOLD : MIN_SUSPEND_THRESHOLD,
		init_done : false,
		
		init : function(options) {
			$.extend(true, this.options, options);
			
			// backup original event titles - we'll need them later
			// for appending imported event titles
			this.options.original_title_before_down = this.options.title_before_down;
			this.options.original_title_before_up = this.options.title_before_up;
			
			// backup countup limit from shortcode or widget settings. We will need this
			// value when requesting next event. this.options.countup_limit will change
			// during counter life to indicate the next query interval
			this.options.original_countup_limit = this.options.countup_limit;
			
			this.SUSPEND_THRESHOLD = MIN_SUSPEND_THRESHOLD;
			this.init_done = false;
			this.acc_correction = 0;
			
			if(this.options.customize_preview == 1) {
				// Customize preview - get deadline from temporal instance
				// or TODO: event import plugin ?
				
				/* Actually we have a full-featured temporal instance here (this.options), 
				 * so we could implement a real preview using queryNextEvent() with some
				 * additional params (?) - we have to block widget SQL query by ID, because
				 * it will provide main instance settings, not the temporal one... $$$
				 */
				this.options.deadline = new Date(new Date(this.options.deadline).getTime() /* + 0 put a value here if we need initial correction */).toString();
				
				// init awake detect timestamp
				this.awake_detect = new Date().getTime() - MILIS_IN_SECOND;
				
				this.updateCounter(this.getCounterValues(this.options.now));
				scds_container.updateInstance(this.options.id, this);
			} else {
				// normal view - get next event from server
				this.queryNextEvent(true);
			}
		},
		tick : function(from_timer) {
			var delta = this.options.mode == 'up' ? 1 : -1;
			
			// Check if browser was suspended or js was paused
			
			// get time elapsed since last tick
			var current = new Date().getTime();
			var elapsed = current - this.awake_detect;
			// Immediately update awake_detect value
			this.awake_detect = current;
			
			// depending on init stage we have to handle accumulated corection
			if(this.init_done) {
				// normal flow, tick() was triggered from fireAllCounters() timer
				// normally elapsed in a running counter will be very close to MILIS_IN_SECOND
				// acc_correction will hold the deviance from this MILIS_IN_SECOND value.
				// In case of suspend/resume event acc_correction can grow much bigger and 
				// it will be used when counter value is adjusted.
				// After adjustment we will reset acc_correction to 0
				this.acc_correction = this.acc_correction + (elapsed - MILIS_IN_SECOND);
			} else {
				// very early tick in counter life cycle
				if(from_timer) {
					// this is a tick from timer, we have to set init_done flag, so that on
					// next tick we can begin working with acc_correction
					this.init_done = true;
				}
				// on early stage we get a tick right after the init tick - it is the first
				// one triggered by fireAllCounters() timer. Usually is comes in approx. 250ms
				// after the init tick but just in case we catch an abnormal delay here
				this.acc_correction = elapsed >= MILIS_IN_SECOND ? (elapsed - MILIS_IN_SECOND) : 0;
			}
			
			// At this point "acc_correction" should be around 0 for normal run
			
			if(this.acc_correction > this.SUSPEND_THRESHOLD) {
				this.SUSPEND_THRESHOLD += SUSPEND_THRESHOLD_RELAX_STEP;
				
				// suspend-resume detected. Adjust timestamps by the time
				// actually elapsed while suspended
				this.options.now += (this.acc_correction + MILIS_IN_SECOND );
				this.diff = this.diff + (this.acc_correction + MILIS_IN_SECOND ) * delta;
				this.acc_correction = 0;
				
				if(this.options.mode == 'down' && this.diff <= 0) {
					// deadline reached while suspended, change mode and send current
					// adjusted coutup diff
					this.deadlineReached(this.diff * -1);
				} else {
					// recalculate counter values
					// when browser is resumed, values queue can contain
					// values which are not sequential. We pass "resumed"
					// parameter here (reserved)
					this.softInitCounter(true);
				}
				// simplify animations on resume
				this.initDisplay = true;
				return;
			} else if(this.SUSPEND_THRESHOLD > MIN_SUSPEND_THRESHOLD) {
				this.SUSPEND_THRESHOLD -= SUSPEND_THRESHOLD_RESTRICT_STEP;
			}
			
			/* check system and internal "now" (for localhost)
			console.log('===== Tick recoded at ' + new Date().toString() + ' =====');
			console.log('Internal now: ' + new Date(this.options.now).toString());
			*/
			
			// check for counter mode limits every tick - we do it before incrementing
			// diff, so we react to countup limit reached on time
			this.applyCounterLimits();
			
			if(this.init_done) {
				// normal run, modify timestamps by 1000 exactly, so that
				// small timer fluctuations will not accumulate timing errors
				this.diff += delta * MILIS_IN_SECOND;
				this.options.now += MILIS_IN_SECOND;
			}

			// copy current values to new_values
			var new_values = $.extend({},this.current_values);
			
			// always advance seconds, even if they are not displayed
			new_values.seconds += delta;
			
			// update time units on seconds limit according to counter display
			// settings
			
			// 'up' mode
			if(new_values.seconds >= this.options.limits.seconds) {
				// if seconds value reaches 24h threshhold we always recalculate
				// counter values
				if(new_values.seconds >= SECONDS_IN_DAY) {
					this.softInitCounter();
					return;
				}
				// normal overflow, increment next higher displayed unit
				new_values.seconds = 0;
				if(this.options.units.minutes == 1) {
					// minutes displayed
					new_values.minutes++;
					if(new_values.minutes >= this.options.limits.minutes) {
						new_values.minutes = 0;
						if(this.options.units.hours == 1) {
							// minutes and hours displayed
							new_values.hours++;
							if(new_values.hours >= this.options.limits.hours) {
								this.softInitCounter();
								return;
							}
						} else {
							// hours are not displayed but minutes have reached the
							// MINUTES_IN_DAY limit, recalculate counter values
							this.softInitCounter();
							return;
						}
					}
				} else if(this.options.units.hours == 1) {
					// only hours are displayed
					new_values.hours++;
					if(new_values.hours >= this.options.limits.hours) {
						this.softInitCounter();
						return;
					}
				}
				// if neither minutes nor hours are displayed, we shouldn't
				// ever get to this point. Counter values recalculation method
				// should have been already called		
			}
			
			// 'down' mode
			if(new_values.seconds < 0) {
				// check for deadline
				if(this.diff <= 0) {
					return this.deadlineReached(0);
				}
				new_values.seconds = this.options.limits.seconds - 1;
				if(this.options.units.minutes == 1) {
					// minutes displayed
					new_values.minutes--;
					if(new_values.minutes < 0) {
						new_values.minutes = this.options.limits.minutes - 1;
						if(this.options.units.hours == 1) {
							// minutes and hours displayed
							new_values.hours--;
							if(new_values.hours < 0) {
								this.softInitCounter();
								return;
							}
						} else {
							// hours are not displayed but minutes have crossed zero,
							// recalculate counter values
							this.softInitCounter();
							return;
						}
					}
				} else if(this.options.units.hours == 1) {
					// only hours are displayed
					new_values.hours--;
					if(new_values.hours < 0) {
						// recalculate counter values
						this.softInitCounter();
						return;
					}
				} else {
					// neither minutes nor hours are displayed.
					// recalculate counter values
					this.softInitCounter();
					return;
				}
			}
			
			this.display(new_values);
		},
		/**
		 * A set of calls for soft counter init:
		 * - Recalulate the counter values
		 * - If "resumed" param is set, set validate queue mode
		 */
		softInitCounter : function(resumed) {
			if(resumed) {
				// additional actions on resume. Reserved ***
			}
			this.updateCounter(this.getCounterValues(this.options.now));
		},
		deadlineReached : function(new_diff) {
			// test only!!!
			// Force animations re-init in new mode. Document it better
			// or move to modeChanged() or hardInit()...
			$('#' + this.options.id + ' .scd-digit').remove();

			this.options.mode = 'up';
			this.diff = new_diff;
			var new_values = this.getCounterValues(this.options.now);
			this.updateCounter(new_values);

			// update units visibilty, new_diff may be far from zero if the
			// deadline was reached while suspended, so we must counter
			// visibility here
			this.setCounterUnitsVisibility(new_values);
			
			// redirect if set so in options
			if(this.options.redirect_url != '') {
				window.location = this.options.redirect_url;
			}
		},
		/*
		 * This method performs the main work of calculating counter values
		 * It uses current instance display options along with event deadline
		 * (target date and time) to set correct values relative to "now"
		 * argument. On widget initialization "now" is read from options
		 * (system time) but later, e.g. on suspend/resume event this value
		 * will be corrected by suspend time, so that a valid "now" will not
		 * be requested from server - can be useful in case of short and repeated
		 * suspend periods
		 */
		getCounterValues : function(now_ts) {
			// init Date objects from this.options.deadline and now
			var t, dateFrom, dateTo;
			
			dateFrom = new Date(now_ts);
			
			// we expect ISO format here
			var dateTo = new Date(this.options.deadline);
			if(isNaN(dateTo.getTime())) {
				// panic fallback
				dateTo = new Date();
			}
			
			// swap dateTo and dateFrom for 'up' mode and
			// set surrent counter mode ('down'/'up')
			this.diff = dateTo - dateFrom;
			
			if(this.diff <= 0) {
				this.options.mode = 'up';
				var tmp = dateFrom;
				dateFrom = dateTo;
				dateTo = tmp;
				this.diff = this.diff * -1;
			} else {
				this.options.mode = 'down';
			}
			
			// get dates components as properties for faster access
			var target = dateToObject(dateTo);
			var now = dateToObject(dateFrom);
			
			// calculate this.difference in units (years, months, days, hours,
			// minutes and seconds)
			
			var yearsDiff = target.year - now.year;
			var monthsDiff = target.month - now.month;
			var daysDiff = target.day - now.day;
			var hoursDiff = target.hours - now.hours;
			var minutesDiff = target.minutes - now.minutes;
			var secondsDiff = target.seconds - now.seconds;
			
			if(secondsDiff < 0) {
				minutesDiff--;
				secondsDiff += SECONDS_IN_MINUTE;
			}
			if(minutesDiff < 0) {
				hoursDiff--;
				minutesDiff += MINUTES_IN_HOUR;
			}
			if(hoursDiff < 0) {
				daysDiff--;
				hoursDiff += HOURS_IN_DAY;
			}
			if(daysDiff < 0) {
				monthsDiff--;
				daysDiff += daysInPrevMonth(target.year, target.month);
			}
			if(monthsDiff < 0) {
				yearsDiff--;
				monthsDiff += MONTHS_IN_YEAR;
			}
			// Year diff must be always >= 0: if initial now is greated than initial target we swap them!
			
			// Set counter values according to display settigns
			
			// days-hours-seconds part of the interval
			var timeSpan = (hoursDiff * SECONDS_IN_HOUR + minutesDiff * SECONDS_IN_MINUTE + secondsDiff) * MILIS_IN_SECOND;
			
			// get months part end date by subtracting days and time parts from target
			var monthsEnd = new Date(dateTo.valueOf() - daysDiff * MILIS_IN_DAY - timeSpan);
			
			// get months part of the diff interval
			var startMonth = monthsEnd.getMonth() - monthsDiff;
			var startYear = target.year;
			if(startMonth < 0) {
				startYear--;
			}
			var monthsStart = new Date(startYear, startMonth, monthsEnd.getDate(), monthsEnd.getHours(), monthsEnd.getMinutes(), monthsEnd.getSeconds());
			var monthsSpan = monthsEnd.valueOf() - monthsStart.valueOf();
			
			// years part of the interval
			var yearsSpan = this.diff - monthsSpan - daysDiff * MILIS_IN_DAY - timeSpan;
			
			// construct resulting values
			var result = {
					/*
					years : null,
					months : null,
					days : null,
					hours : null,
					minutes : null,
					seconds : null
					*/
			};
			var restDiff = this.diff;
			
			// tricky cases
			
			// if years or months are displayed we have to subtract yearsSpan
			// from restDiff
			if(this.options.units.years == 1 || this.options.units.months == 1) {
				restDiff = restDiff - yearsSpan;
			}
			if(this.options.units.years == 1) {
				result.years = yearsDiff;
			} else if(this.options.units.months == 1) {
				// no years but months present: adjust monthsDiff
				monthsDiff = monthsDiff + yearsDiff * MONTHS_IN_YEAR;
			}
			if(this.options.units.months == 1) {
				// show months value, monthsDiff could have already been adjusted if
				// years are hidden
				restDiff = restDiff - monthsSpan;
				result.months = monthsDiff;
			} else {
				// no month display. We can rely on restDiff to calculate remainig
				// days value (restDiff could be already adjusted due to year and/or
				// month display settings
				daysDiff = Math.floor(restDiff / MILIS_IN_DAY);
			}
			// easy cases: starting from weeks unit and lower we can use simple
			// division to calculate values. No days-in-month and leap years stuff.
			// We chain restDiff subtraction on each unit that is displayed, so that
			// next lower unit showes correct value
			if(this.options.units.weeks == 1) {
				var weeksDif = Math.floor(daysDiff / 7); // entire weeks
				daysDiff = daysDiff % 7; // days left
				restDiff = restDiff - weeksDif * 7 * MILIS_IN_DAY;
				result.weeks = weeksDif;
			}
			if(this.options.units.days == 1) {
				result.days = Math.floor(restDiff / MILIS_IN_DAY);
				restDiff = restDiff - daysDiff * MILIS_IN_DAY;
			}
			if(this.options.units.hours == 1) {
				result.hours = Math.floor(restDiff / MILIS_IN_HOUR);
				restDiff = restDiff - result.hours * MILIS_IN_HOUR;
			}
			if(this.options.units.minutes == 1) {
				result.minutes = Math.floor(restDiff / MILIS_IN_MINUTE);
				restDiff = restDiff - result.minutes * MILIS_IN_MINUTE;
			}
			// always include seconds in result. Even if seconds are not displayed on
			// screen according to widget configuration, they will be rendered as hidden.
			// Also seconds must be there for the "easy inc/dec" method to work -
			// performance optimization to avoid heavy calculations in tick() method
			result.seconds = Math.floor(restDiff / MILIS_IN_SECOND);
			
			// set overflow limits
			if(this.options.units.minutes == 1) {
				this.options.limits.seconds = SECONDS_IN_MINUTE;
			} else {
				if(this.options.units.hours == 1) {
					this.options.limits.seconds = SECONDS_IN_HOUR;
				} else {
					this.options.limits.seconds = SECONDS_IN_DAY;
				}
			}
			if(this.options.units.hours == 1) {
				this.options.limits.minutes = MINUTES_IN_HOUR;
			} else {
				this.options.limits.minutes = MINUTES_IN_DAY;
			}
			
			return result;
			
			// Helper functions
			function dateToObject(date) {
				return {
					year : date.getUTCFullYear(),
					month : date.getUTCMonth() + 1,
					day : date.getUTCDate(),
					hours : date.getUTCHours(),
					minutes : date.getUTCMinutes(),
					seconds : date.getUTCSeconds()
				}
			}
			function daysInPrevMonth(year, month) {
				month = month - 2; // -1 for JS Date month notaion (0-11) - 1 for previous month
				if(month < 0) {
					year--;
				}
				return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
			}
		},
		updateCounter : function(new_values) {
			this.display(new_values);
			this.displayTexts(); // *** this call is required only on mode down/up change
			// e.g. texts are dirty
		},
		display : function(new_values) {
			var prev, next;
			if(typeof this.current_values.seconds === 'undefined') {
				// first hard init case. Make this logic better!!! ***
				this.initDisplay = true;
				this.current_values = new_values;
				this.tick();
				return;
			} else {
				prev = this.current_values;
			}
			next = new_values;
			
			// Update counter output
			var i, self = this, updateUnitsWidth = false;
			$.each(this.options.units, function(asset, display) {
				if(display == 0 || (!self.initDisplay && next[asset] == prev[asset])) {
					return; // no display or unit has not changed - continue loop
				}
				// only update on init or if the value actually changed
				if(self.updateCounterUnit(asset, prev[asset], next[asset], self.initDisplay) === true) {
					// if number of digits displayed has change for a counter unit,
					// updateCounterUnit() will return true
					updateUnitsWidth = true;
				}
			});
			
			// Update digits width if required
			if(updateUnitsWidth) {
				this.setRowVerticalAlign();
				this.responsiveAdjust();
			}
			
			if(this.initDisplay ||
					(this.options.mode == 'down' && next.seconds == this.options.limits.seconds - 1) || 
					(this.options.mode == 'up' && next.seconds == 0)) {
				this.setCounterUnitsVisibility(next);
			}
			
			this.initDisplay = false;
			
			this.current_values = new_values;
			
			// moved to tick itself
			// check for counter mode limits every tick
			//this.applyCounterLimits();
		},
		displayTexts : function() {
			if(this.options.mode == 'up') {
				$('#' + this.options.id + '-title-before').html(this.options.title_before_up);
				$('#' + this.options.id + '-title-after').html(this.options.title_after_up);
			} else {
				$('#' + this.options.id + '-title-before').html(this.options.title_before_down);
				$('#' + this.options.id + '-title-after').html(this.options.title_after_down);
			}
		},
		/**
		 * Update counter unit - digits and label
		 */
		updateCounterUnit : function(asset, old_value, new_value, initDisplay) {
			old_value = this.padLeft(old_value, this.options.paddings[asset]);
			new_value = this.padLeft(new_value, this.options.paddings[asset]);
			
			// test only labels!
			$('#' + this.options.id + '-' + asset + '-label').text(this.getLabel(asset, new_value));
			
			var wrapper = $('#' + this.options.id + '-' + asset + '-digits');
			var count = wrapper.children('.scd-digit').length;
			
			var updateDigitsWidth = false, new_digits;
			
			if(new_value.length != count) {
				new_digits = this.updateDigitsCount(asset, count, old_value, new_value, wrapper);
				old_value = new_digits.old_value;
				new_value = new_digits.new_value;
				updateDigitsWidth = true;
			}
			
			// we have to split the values by digits to check which one actually must
			// be updated
			var values = {
					'prev' : old_value.split(''),
					'next' : new_value.split(''),
			};
			
			for(i = 0; i < values['next'].length; i++) {
				if(values['prev'][i] != values['next'][i] || initDisplay) {
					// pass both old and new digit value, also scalar new unit value for
					// margin digits calculation basing on current counter display options
					// and the unit in question (asset parameter)
					this.updateCounterDigit(asset, $(wrapper).children('.scd-digit').eq(i), values['next'].length - i - 1, values['prev'][i], values['next'][i], old_value, new_value, initDisplay);
				}
			}
			
			return updateDigitsWidth;
		},
		// left pad with zero helper
		padLeft : function(value, len) {
			value = value + '';
			if(value.length < len) {
				value = Array(len + 1 - value.length).join('0') + value;
			}
			return value;
		},
		
		updateDigitsCount : function(asset, current_count, old_value, new_value, wrapper) {
			var i;
			if(new_value.length < current_count) {
				// remove unused high digit(s)
				for(i = current_count - 1; i >= new_value.length; i--) {
					delete(this.elements[asset + i]);
					wrapper.children('.scd-digit').first().remove();
				}
				old_value = old_value.slice(old_value.length - new_value.length);
				return { old_value : old_value, new_value : new_value };
			} else {
				// initialize digits or add missing high digit(s)
				var new_digit, guess_prev_value, config_index, config;
				
				for(i = current_count; i < new_value.length; i++) {
					new_digit = $('<div class="scd-digit"></div>');
					wrapper.prepend(new_digit);
					// in init mode we use old_value as previous digit value, otherwise we are
					// processing a "digits count changed" case, so we assume that previous
					// digit value is always "0" (as if the old value were padded by zeros)
					guess_prev_value = current_count == 0 ?  old_value[i] : '0';
					
					// When adding a new digit we look for custom digit configuration. For now we support "0"
					// for compatibility with existing fx profiles - it will mostly be used to make seconds-low
					// animations faster. The rest of custom digit position must be expressed in asset+index form
					// (less index = lower digit) but should be used with caution because the number of digits in
					// real counters may differ due to options.unts setting
					config_index = (i == 0 && asset == 'seconds' ? 0 : asset + i);
					config = typeof this.options.animations.digits[config_index] === 'undefined' ? this.options.animations.digits['*'] : this.options.animations.digits[config_index];
					
					this.setElements(new_digit, { 'prev' : guess_prev_value, 'next' : new_value[i - current_count] }, asset + i, config);
				}
				old_value = this.padLeft(old_value, new_value.length);
				return { old_value : old_value, new_value : new_value };
			}
		},
		/**
		 * Method to actually update a counter digit. All digit transition and animation must be
		 * performed here.
		 */
		updateCounterDigit : function(asset, wrapper, index, old_digit, new_digit, old_unit_value, new_unit_value, initDisplay) {
			var hash_prefix = asset + index;
			
			var values = {
					'prev' : old_digit,
					'next' : new_digit
			}
			// test-only not a bullet-proof guess! ***
			if(this.options.animations.uses_margin_values == 1) {
				if(this.options.mode == 'down') {
					values['pre-prev'] = this.guessIncrValue(asset, index, old_digit, old_unit_value);
					values['post-next'] = this.guessDecrValue(asset, index, new_digit, new_unit_value);
				} else {
					values['pre-prev'] = this.guessDecrValue(asset, index, old_digit, old_unit_value);
					values['post-next'] = this.guessIncrValue(asset, index, new_digit, new_unit_value);
				}
				if(initDisplay) {
					// on init "next" and "prev" are equal (this is a design flaw)
					// calculated "pre-prev" will never be visible, so we can use it
					// as simple "prev" (*** WORKAROUND, not beautiful at all...)
					values['prev'] = values['pre-prev'];
				}
			}
			
			var config_index = (index == 0 && asset == 'seconds' ? 0 : asset + index);
			var config = typeof this.options.animations.digits[config_index] === 'undefined' ? this.options.animations.digits['*'] : this.options.animations.digits[config_index];
			var groups = config[this.options.mode];
			
			if(initDisplay) {
				this.setElements(wrapper, values, hash_prefix, config);
			}
			this.animateElements(values, hash_prefix, groups);
		},
		guessIncrValue : function(asset, index, digit_value, unit_value) {
			var limit = this.guessDigitLimit(asset, index, digit_value, unit_value);
			if(++digit_value > limit) {
				digit_value = 0;
			}
			return digit_value;
		},
		guessDecrValue : function(asset, index, digit_value, unit_value) {
			var limit = this.guessDigitLimit(asset, index, digit_value, unit_value);
			if(--digit_value < 0) {
				digit_value = limit;
			}
			return digit_value;
		},
		guessDigitLimit : function(asset, index, digit_value, unit_value) {
			var limit = 9;
			if(asset == 'seconds') {
				if(this.options.units['minutes'] == 1) {
					if(index != 0) {
						limit = 5
					}
				}
			} else if(asset == 'minutes') {
				if(this.options.units['hours'] == 1) {
					if(index != 0) {
						limit = 5
					}
				}
			} else if(asset == 'hours' && this.options.units['days'] == 1) {
				if(index == 1) {
					limit = 2;
				} else if(index == 0 && unit_value >= 20) {
					limit = 3;
				}
			}
			return limit;
		},
		
		setElements : function(wrapper, values, prefix, config) {
			wrapper.empty();
			this.elements[prefix] = {};
			
			wrapper.css(config.style);
			var groups = config[this.options.mode];
			
			var i, group;
			for(i = 0; i < groups.length; i++) {
				group = groups[i];
				var els = group.elements, j, el, $el, hash;
				for(j = 0; j < els.length; j++) {
					el = els[j];
					hash = this.getElementHash(el);
					$el = this.createElement(el, values);
					
					if(el.content_type == 'static-bg') {
						$el.attr('src', this.options.animations.images_folder + el.filename_base + el.filename_ext);
					}
					
					// we have to add created element to collection by unique hash,
					// so that element duplicates are not appended to wrapper, but can
					// be referenced without ambiguity when we prodeed with animations
					// *** store only first unique occurrence
					if(typeof this.elements[prefix][hash] === 'undefined') {
						this.elements[prefix][hash] = $el;
					}
				}
			}
			
			$.each(this.elements[prefix], function(hash, el) {
				wrapper.append(el);
			});
		},
		
		animateElements : function(values, prefix, groups) {
			var i, group;
			
			for(i = 0; i < groups.length; i++) {
				group = groups[i];
				var j, el, $el, value;
				for(j = 0; j < group.elements.length; j++) {
					el = group.elements[j];
					
					if(el.content_type == 'static-bg') {
						// no animation for static background
						continue;
					}
					
					$el = this.elements[prefix][this.getElementHash(el)];
					
					// resore original style(s) for all elements before we start the real animation
					$el.css(el.styles);
				}
			}
			
			// animate first group, next group animation (if any) will be launched after the
			// previous group's animation is finished
			this.animateGroup(values, 0, prefix, groups);
		},
		animateGroup : function(values, group_index, prefix, groups) {
			if(group_index >= groups.length) {
				return;
			}
			var i, group = groups[group_index], el, $el, styles, self = this;
			var duration = this.initDisplay ? 0 : +group.duration; // in initDisplay mode we make all animations instant, i.e. duration = 0
			var transition = group.transition;
			var elements_count = group.elements.length, cur_element_index = 0, group_processed = false;
			
			for(i = 0; i < group.elements.length; i++) {
				// get stored element
				el = group.elements[i];
				
				if(el.content_type == 'static-bg') {
					// no animation for static background
					elements_count--; // the element is not included in group for
					// animation, adjust elements_count, so that we can detect
					// when all elements in group are processed
					continue;
				}
				
				$el = this.elements[prefix][this.getElementHash(el)];
				
				// apply tween.from styles
				$el.css(el.tweens.from);
				
				value = el.content_type == 'uni-img' ? '' : values[el.value_type];
				if(el.content_type == 'txt') {
					$el.text(value);
				} else {
					var src = this.options.animations.images_folder + el.filename_base + value + el.filename_ext;
					$el.attr('src', src);
				}
				
				// We are sure that at least 1 element qualified for animation was found in the group
				group_processed = true;
				
				if(el.tweens.to.length === 0) { // objects have length undefined, so only empty array
					// will pass this condition
					// if tweens are empty we have to simulate animation duration. Of course,
					// it is possible to use a "trivial" tween hack, e.g. <width>100,100</width>,
					// but using native setTimeout() shoud be better.
					if(duration > 0) {
						// even timeout zero causes animations on init, so if group duration = 0
						// we increment cur_element_index directly and proceed to next group if
						// required.
						window.setTimeout(function() {
							cur_element_index++;
							if(cur_element_index >= elements_count) {
								self.animateGroup(values, group_index + 1, prefix, groups);
							}
						}, duration);
					} else {
						cur_element_index++;
						if(cur_element_index >= elements_count) {
							this.animateGroup(values, group_index + 1, prefix, groups);
						}
					}
				} else {
					// we have tweens defined. Proceed with animation. Do not animate
					// elements that are currently being animated - prevent
					// animations mess up on tab switch back and resume in some
					// browsers
					if($el.is(':animated')) {
						// decrement elements-left count
						cur_element_index++;
						if(cur_element_index >= elements_count) {
							this.animateGroup(values, group_index + 1, prefix, groups);
						}
					} else {
						// actually start animation
						$el.animate(el.tweens.to, duration, transition, function() {
							cur_element_index++;
							if(cur_element_index >= elements_count) {
								self.animateGroup(values, group_index + 1, prefix, groups);
							}
						});
					}
				}
			}
			
			if(!group_processed) {
				// empty group or a group containing only 'static-bg' elements.
				// In some animations this kind of a group serves as a pause in animations queue
				window.setTimeout(function() {
					self.animateGroup(values, group_index + 1, prefix, groups);
				}, duration);
			}
			
		},
		getElementHash : function(el) {
			return [el.content_type, el.value_type, el.filename_base, el.filename_ext].join('::');
		},
		/*
		 * Create DOM element using jQuery, basing on "el" object properties (content_type, tag, etc...)
		 */
		createElement : function(el, values) {
			var $el;
			if(el.content_type == 'txt') {
				$el = $('<' + el.tag + '/>');
				$el.text(values[el.value_type]);
			} else {
				var value = el.content_type == 'img' ? values[el.value_type] : '', src;
				src = this.options.animations.images_folder + el.filename_base + value + el.filename_ext;
				
				$el = $('<' + el.tag + '/>');
				$el.attr('src', src);
			}
			$el.css(el.styles);
			return $el;
		},
		getLabel : function(asset, value) {
			var labels = {
				years : 'Y',
				months : 'M',
				weeks : 'W',
				days : 'D',
				hours : 'H',
				minutes : 'Min',
				seconds : 'Sec'
			};
			
			var suffix = smartcountdown_plural(value);
			return smartcountdownstrings[asset + suffix] || labels[asset];
			
			return labels[asset];
		},
		/**
		 * Set counter units visibility according to units display configuration and counter values.
		 * Related settings:
		 * - allow_lowest_zero: show zero in the lowest counter unit, if not allowed, the unit with zero
		 * value will be replaced by a lower non-zero unit and replaced with original unit once its value
		 * is grater than zero
		 * - hide_highest_zeros: hide highest counter units until a non-zero unit is found, even if these
		 * high units are set up as "displayed" in units configuration
		 */
		setCounterUnitsVisibility : function(new_values) {
			// restore original hide_lower_units from configuration
			var hide_units = $.extend([], this.options.hide_lower_units);
			var i, assets = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'];
			
			// allow_lowest_zero feature
			if(this.options.allow_lowest_zero == 0 && $.inArray('seconds', hide_units) != -1) {
				var index;
				var lowest_displayed_unit = -1;
				for(i = 0; i < assets.length; i++) {
					index = $.inArray(assets[i], hide_units);
					if(index == -1) {
						lowest_displayed_unit = i;
					}
				}
				if(lowest_displayed_unit >= 0 && new_values[assets[lowest_displayed_unit]] == 0) {
					for(i = lowest_displayed_unit; i < assets.length; i++) {
						if(new_values[assets[i]] > 0 || assets[i] == 'seconds') {
							index = $.inArray(assets[i], hide_units);
							if(index > -1) {
								hide_units.splice(index, 1);
								// replace unit with zero values with a non-zero lower one
								if(this.options.replace_lowest_zero == 1) {
									hide_units.push(assets[lowest_displayed_unit]);
								}
								break;
							}
						}
					}
				}
			}
			
			// hide_highest_zeros feature
			if(this.options.hide_highest_zeros == 1) {
				var lowest_displayed_unit = -1;
				for(i = 0; i < assets.length; i++) {
					if(this.options.units[assets[i]] == 0) {
						continue;
					}
					lowest_displayed_unit = i;
					if(new_values[assets[i]] == 0) {
						if($.inArray(assets[i], hide_units) == -1) {
							hide_units.push(assets[i]);
						}
					} else {
						break;
					}
				}
				
				// if lowest zero unit found, remove it from hide_units
				if(lowest_displayed_unit > -1 && new_values[assets[lowest_displayed_unit]] == 0) {
					hide_units.splice(lowest_displayed_unit, 1);
				}
			}
			
			// apply calculated hide_units configuration
			var self = this;
			$.each(this.options.units, function(asset, display) {
				var unit_wrapper = $('#' + self.options.id + '-' + asset);
				if(display == 1 && $.inArray(asset, hide_units) == -1) {
					//unit_wrapper.show();
					// we have to display units as inline-block
					unit_wrapper.css('display', 'inline-block');
				} else {
					unit_wrapper.hide();
				}
			});
			
			this.setRowVerticalAlign();
			this.responsiveAdjust();
			
			var counter_container = $('#' + this.options.id);
			
			/* *** a sort of a panic action - no counter units are displayed, we have to hide the whole widget*/
			if(hide_units.length < 7) {
				counter_container.show();
			} else {
				counter_container.hide();
			}
			/**/
			
			// For count up mode we implement an option to completely hide
			// counter digits block after the event time is reached
			if(this.options.mode == 'up') {
				if(this.options.hide_countup_counter == 1) {
					counter_container.find('.scd-counter').hide();
					counter_container.show();
				} else {
					counter_container.find('.scd-counter').show();
				}
			} else {
				// in "down" mode we always show counter block. The whole
				// widget will be hidden if required in applyCounterLimits()
				counter_container.find('.scd-counter').show();
			}
			
			// if the counter is clickable, set the handler
			if(this.options.click_url != '') {
				counter_container.css('cursor', 'pointer');
				counter_container.off('click');
				counter_container.on('click', function() {
					window.location = self.options.click_url;
				});
			} else {
				counter_container.css('cursor', 'default');
				counter_container.off('click');
			}
			
			// add quick check for counter display mode limits
			this.applyCounterLimits();
		},
		
		applyCounterLimits : function() {
			var counter_container = $('#' + this.options.id);
			
			// show widget before/after event limits
			if(this.options.mode == 'down') {
				if(this.options.countdown_limit >= 0 && this.diff >= this.options.countdown_limit * MILIS_IN_SECOND) {
					counter_container.hide();
				} else {
					counter_container.show();
				}
			}
			if(this.options.mode == 'up') {
				if(this.options.countup_limit >= 0 && this.diff >= this.options.countup_limit * MILIS_IN_SECOND) {
					/*
					console.log('Current diff: ' + this.diff);
					console.log('Up limit: ' + this.options.countup_limit);
					console.log('Internal now: ' + new Date(this.options.now).toString());
					*/
					this.queryNextEvent();
					
					// disable countup limit temporarly, so that no more queryNextEvent() are
					// done. Correct countup limit will be set when the event request is done.
					// *** we do countup limit reset after calling queryNextEvent(), so that
					// actual limit value can be used inside queryNextEvent() method. Anyway,
					// resetting countup limit here will guarantee that no more queries will
					// be done while current one is in progress
					this.options.countup_limit = -1;
				}
			}
		},
		
		/*
		 * TODO: check if we can optimize calls to this method. For now it is called twice
		 * in some cases. This is not a big problem - the function is quite fast and at most
		 * called each minute, but for the sake of code cleanness...
		 */
		setRowVerticalAlign : function() {
			// calculate labels maximum width(s) for all singular/plural forms
			if(typeof this.label_min_widths === 'undefined') {
				// widths are calculated in em, so it has to be done only once
				if(this.updateMinLabelsWidth() === false) {
					// updateMinLabelsWidth failed, e.g. no visible labels - do nothing
					return;
				}
			}
			
			// align digits - for counter column layout only
			var digits = $('#' + this.options.id + ' .scd-unit-vert .scd-digits-row:visible');
			if(digits.length > 0) {
				var maxWidth = 0, width;
				digits.css('min-width', '');
				digits.each(function() {
					width = $(this).width();
					if(width > maxWidth) {
						maxWidth = width;
					}
				});
				digits.css('min-width', maxWidth);
			}
			
			// Labels min-widths are expressed in 'em'.
			
			// all row labels for vertical counter layout must have the same min-width =
			// maximum width of all labels/all forms
			var labels = $('#' + this.options.id + ' .scd-unit-vert .scd-label-row:visible');
			labels.css('min-width', this.labels_max_width + 'em');
			
			// for horizontal counter layout we set:
			// - column labels: to maximum width of all labels/all forms
			// - row labels: to maximum width of all forms for this label only
			labels = $('#' + this.options.id + ' .scd-unit-horz .scd-label:visible');
			if(labels.length > 0) {
				var self = this;
				labels.each(function() {
					var $this = $(this);
					width = $this.width();
					if($this.hasClass('scd-label-col')) {
						// same width for all
						$this.css('min-width', self.labels_max_width + 'em');
					} else {
						// maximum width for this label (singular/plural forms)
						$this.css('min-width', self.label_min_widths[$this.attr('id')] + 'em');
					}
				});
			}
			this.setLabelsPosition();
		},
		
		updateMinLabelsWidth : function() {
			// use the fisrt visible label as test element for measuring. This method is called only once per
			// script life-time and on early stage, so we can rely on visible pseudo-selector: counter visibilty
			// is not updated yet, so all labels are visible. This can be a design flaw if program logic changes
			var test_label = $('#' + this.options.id + ' .scd-label:visible').first(), unit, label_id, width, max_width = 0;
			if(test_label.length == 0) {
				// panic
				return false;
			}
			// backup existing text
			var the_text = test_label.text();
			// reset measurement
			test_label.css('min-width', '');
			this.label_min_widths = {};
			// loop through all label strings injected in js script
			for(label_key in smartcountdownstrings) {
				// get unit name for object key
				unit = label_key.split('_', 1)[0];
				if(!unit) {
					unit = label_key;
				}
				// constuct label id - it will be used as label_min_widths key and for fast
				// access to label attributes
				label_id = this.options.id + '-' + unit + '-label';
				
				if(typeof this.label_min_widths[label_id] === 'undefined') {
					// on first iteration initialize the value
					this.label_min_widths[label_id] = 0;
				}
				// set test label text
				test_label.text(smartcountdownstrings[label_key]);
				// do the measurement in 'em' based on labels size
				width = test_label.width() / this.options.labels_size;
				// update unit maximum
				if(this.label_min_widths[label_id] < width) {
					this.label_min_widths[label_id] = width;
				}
				// keep track of the maximum-for-all width
				if(max_width < width) {
					max_width = width;
				}
				// all widths are expressed in em, but stored as float numbers -
				// make sure we append 'em' to these values when applying as css
			}
			// store maximum-for-all width
			this.labels_max_width = max_width;
			// clean up - restore original text of the test label
			test_label.text(the_text);
		},
		
		// update labels vertical position for left or right labels placement
		setLabelsPosition : function() {
			// reset position for column lables
			$('#' + this.options.id + ' .scd-label-col:visible').css('position', '');
			
			// adjust labels position if neeed (if vertical label position is set)
			var labels = $('#' + this.options.id + ' .scd-label-row:visible');
			if(labels.length > 0) {
				var digitsDiv, digitsHeight, labelHeight, top, self = this;
				labels.each(function() {
					var $this = $(this);
					digitsDiv = $this.siblings('.scd-digits-row');
					digitsHeight = digitsDiv.height();
					labelHeight = $this.height();
					
					// check if digits and label are horizontally overlapping
					var a = digitsDiv[0].getBoundingClientRect();
					var b = this.getBoundingClientRect();
					if(!( // we allow adjacent divs
							b.left > a.right ||
							b.right < a.left ||
							b.top > a.bottom ||
							b.bottom < a.top
					)) {
						$this.css('position', '');
						$this.css('top', '');
						return true; // continue iteration
					}
					// continue with position (normal flow)
					$this.css('position', 'relative');
					switch(self.options.labels_vert_align) {
						case 'top' :
							top = 0;
							break;
						case 'bottom' :
							top = digitsHeight - labelHeight;
							break;
						case 'high' :
							top = labelHeight * 0.5;
							break;
						case 'low' :
							top = digitsHeight - labelHeight * 1.5;
							break;
						case 'superscript' :
							top = labelHeight * -0.5;
							break;
						case 'subscript' :
							top = digitsHeight - labelHeight / 2;
							break;
						default:
							top = digitsHeight / 2 - labelHeight / 2;
					}
					$this.css('top', top);
				});
			}
		},
		
		resetAlignments : function(counter_container) {
			counter_container.find('.scd-label').css({ position : '', top : '' });
			counter_container.find('.scd-label, .scd-digits').css('min-width', '');
		},
		
		responsiveAdjust : function(/*width*/) {
			var responsive = this.options.responsive;
			var counter_container = $('#' + this.options.id), i, scale = 1.0, self = this;
			
			if(responsive && responsive.length > 0) {
				// responsive behavior

				// we have to reset all existing labels and digits alignment before proceeding with
				// responsive adjust
				this.resetAlignments(counter_container);
				
				// reset container font before starting measurments
				counter_container.css('font-size', this.options.base_font_size);
				
				// restore original layout before measurement
				var scale_preset = responsive[responsive.length - 1];
				this.applyLayout(counter_container, scale_preset.alt_classes);
				
				// update layout for new font size for correct measurement
				this.setRowVerticalAlign();
				
				// check if horizontal-layout units wrap
				var is_wrapping = this.checkWrapping(counter_container.find('.scd-unit-horz:visible, .scd-title-row'));
				
				if(is_wrapping.wrapped_width > 0) {
					var container_width = counter_container.width();
					var required_width = is_wrapping.row_width + is_wrapping.wrapped_width;
					
					// $$$ Check why we have to use 0.95 k for scale???
					scale = container_width / required_width * 0.95;
				}

				// check extreme case - wrapping digits in unit, do not allow this
				var digit_groups = counter_container.find('.scd-digits:visible'), is_wrapped = false;
				digit_groups.each(function() {
					var $this = $(this);
					var is_wrapping = self.checkWrapping($this.find('.scd-digit'));

					if(is_wrapping.wrapped_width > 0) {
						var container_width = $this.width();
						var required_width = is_wrapping.row_width + is_wrapping.wrapped_width;
						
						var this_scale = container_width / required_width * 0.95;
						// only update current effective scale if we get a lower value here
						if(this_scale < scale) {
							scale = this_scale;
						}
						is_wrapped = true;
					}
				});
				
				// we have suggested scale at this point
				//console.log('Scale: ' + scale);

				// Look at scale alternative layouts in responsive settings
				
				// IMPORTANT: scale nodes must be sorted ascending, otherwise responsive behavior will be
				// unpredictable
				for(i = 0; i < responsive.length; i++) {
					var scale_preset = responsive[i];
					if(scale <= scale_preset.scale) {
						// apply additional classes (if any)
						this.applyLayout(counter_container, scale_preset.alt_classes);
						
						// we are done - no need to continue looping
						break;
					}
				}
				
				// we have alternative layout applied
				
				// prepare to repeat measurement with updated layout - reset base font
				scale = 1.0;
				counter_container.css('font-size', this.options.base_font_size);
				
				// realign labels and measure units (for column layouts)
				this.setRowVerticalAlign();
				
				// check if horizontal-layout units wrap
				var is_wrapping = this.checkWrapping(counter_container.find('.scd-unit-horz:visible, .scd-title-row'));
				
				if(is_wrapping.wrapped_width > 0) {
					var container_width = counter_container.width();
					var required_width = is_wrapping.row_width + is_wrapping.wrapped_width;
					
					// $$$ Check why we have to use 0.95 k for scale???
					scale = container_width / required_width * 0.95;
					counter_container.css('font-size', this.options.base_font_size * scale);
					
					// update layout for new base font size
					this.setRowVerticalAlign();
				}			
			} else {
				// prepare for next measurement if responsive feature is disabled
				counter_container.css('font-size', this.options.base_font_size);
			}
			
			// even if responsive feature is disabled we always check for digits wrapping and
			// scale the widget so that all digits in units are placed on the same line
			var digit_groups = counter_container.find('.scd-digits:visible'), is_wrapped = false;
			digit_groups.each(function() {
				var $this = $(this);
				var is_wrapping = self.checkWrapping($this.find('.scd-digit'));

				if(is_wrapping.wrapped_width > 0) {
					var container_width = $this.width();
					var required_width = is_wrapping.row_width + is_wrapping.wrapped_width;
					
					var this_scale = container_width / required_width * 0.95;
					// only update current effective scale if we get a lower value here
					if(this_scale < scale) {
						scale = this_scale;
					}
					is_wrapped = true;
				}
			});
			if(is_wrapped) {
				// apply new calulated scale
				counter_container.css('font-size', this.options.base_font_size * scale);
			}
			// update layout for new base font size
			this.setRowVerticalAlign();
		},
		
		checkWrapping : function(units) {
			var row_width = 0, wrapped_width = 0, top = null;
			units.each(function() {
				var $this = $(this), unit_position = $this.position();
				if(top === null) {
					top = unit_position.top;
				}
				if(top != unit_position.top) {
					wrapped_width += $this.outerWidth(true);
				} else {
					row_width += $this.outerWidth(true);
				}
			});
			return {
				row_width : row_width, // top row width (non-wrapped units)
				wrapped_width : wrapped_width // all other rows (wrapped units)
			};
		},
		
		applyLayout : function(counter_container, alt_classes) {
			if(alt_classes.length > 0) {
				$.each(alt_classes, function(index, classes) {
					if($.isArray(classes)) {
						$.each(classes, function(ci, c) {
							counter_container.find(c.selector).removeClass(c.remove).addClass(c.add);
						});
					} else {
						counter_container.find(classes.selector).removeClass(classes.remove).addClass(classes.add);
					}
				});
			}
		},
		
		queryNextEvent : function(isNew) {
			var self = this;
			
			// show spinner
			$('#' + self.options.id + '-loading').show();
			
			$('#' + self.options.id + ' .scd-all-wrapper').hide();
			
			var queryData = {
				action : 'scd_query_next_event',
				smartcountdown_nonce : smartcountdownajax.nonce /*,
				// possible caching bugs workaround
				unique : new Date().getTime() */
			};
			if(this.options.shortcode == 1) {
				// shortcode - include deadline date and time and import_plugins in query
				queryData.deadline = this.options.deadline;
				queryData.import_config = this.options.import_config;
				
				// we have to add countup limit from original settings to query data.
				queryData.countup_limit = this.options.original_countup_limit;
			} else {
				// widget - include widget id in query, the rest of widget configuration
				// will be read on server from wp database
				queryData.id = this.options.id;
			}
			$.getJSON(
					smartcountdownajax.url,
					queryData,
					function(response) {
						// hide spinner
						$('#' + self.options.id + '-loading').hide();
						
						$('#' + self.options.id + ' .scd-all-wrapper').show();
						
						if(response.err_code == 0) {
							// Actually we have "self" object already initialized and
							// setup with options (for both widget and shorcode modes)
							
							// we have to add actual "now" and "deadline" here, it
							// should work for plain counters (caching workaround) and
							// also for events import plugins
							
							self.options.deadline = response.options.deadline;
							self.options.now = response.options.now;
							/*
							console.log('Server now: ' + new Date(self.options.now).toString());
							console.log('deadline: ' + self.options.deadline);
							console.log('System now: ' + new Date().toString());
							*/
							// we append imported event title (if any) to counter titles
							// or insert imported title if a placeholder found in original
							if(typeof response.options.imported_title !== 'undefined') {
								// we have imported title
								if(self.options.original_title_before_down != '') {
									if(self.options.original_title_before_down.indexOf('%imported%') != -1) {
										// replace placeholder with imported title
										self.options.title_before_down = self.options.original_title_before_down.replace('%imported%', response.options.imported_title);
									} else {
										// no placeholder - append imported title
										self.options.title_before_down = self.options.original_title_before_down + ' ' + response.options.imported_title;
									}
								} else {
									// generic title empty - use imported title as is
									self.options.title_before_down = response.options.imported_title;
								}
								if(self.options.original_title_before_up != '') {
									if(self.options.original_title_before_up.indexOf('%imported%') != -1) {
										// replace placeholder with imported title
										self.options.title_before_up = self.options.original_title_before_up.replace('%imported%', response.options.imported_title);
									} else {
										// no placeholder - append imported title
										self.options.title_before_up = self.options.original_title_before_up + ' ' + response.options.imported_title;
									}
								} else {
									// generic title empty - use imported title as is
									self.options.title_before_up = response.options.imported_title;
								}
							} else {
								// just in case - remove "imported" placeholders
								self.options.title_before_down = self.options.original_title_before_down.replace('%imported%', '');
								self.options.title_before_up = self.options.original_title_before_up.replace('%imported%', '');
							}
							// some event import plugins may set is_countdown_to_end flag indicating that
							// event date and time are actually end time for an event, so that we should display
							// a countdown but with "up" title
							if(response.options.is_countdown_to_end == 1) {
								self.options.title_before_down = self.options.title_before_up;
							}
							self.options.countup_limit = response.options.countup_limit;
							
							if(response.options.deadline == '') {
								// no next events. TODO: display message(?), etc.
								
								// detach counter from container - this is a definitive
								// shut-down for this counter instance, as there are no future events
								scds_container.remove(self.options.id);
								
								$('#' + self.options.id).hide();
								return;
							}
							// *** TEST ***
							//self.options.deadline = new Date(new Date().getTime() - 45000).toString();
							// *** ***
							
							// convert deadline to javascript Date
							self.options.deadline = new Date(new Date(self.options.deadline).getTime() /* + 0*/).toString();

							// init awake detect timestamp
							self.awake_detect = new Date().getTime() - MILIS_IN_SECOND;
							self.updateCounter(self.getCounterValues(self.options.now));
							
							// widget registration in container is
							// required only for the first event query, switching
							// to next event in a running widgets doesn't require
							// adding widget to container because it is already there
							if(isNew) {
								scds_container.updateInstance(self.options.id, self);
							}
							
							// We have to set counter mode limits and units display after geeting new event
							self.setCounterUnitsVisibility(self.current_values);
						} else {
							// error
						}
					}
				).fail(function(jqxhr, textStatus, error) {
					// report error here...
					$('#' + self.options.id + '-loading').hide();
					
					$('#' + self.options.id + ' .scd-all-wrapper').show();
				});
		}
	}
})(jQuery);