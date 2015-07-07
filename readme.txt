=== Smart Countdown FX Easy Recurring Events ===
Contributors: alex3493 
Tags: smart countdown fx, countdown, counter, count down, timer, event, widget, recurring
Requires at least: 3.6
Tested up to: 4.2.2
Stable tag: 1.4
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Smart Countdown FX Easy Recurring Events adds recurring events support to Smart Countdown FX.

== Description ==
Smart Countdown FX Easy Recurring Events **requires [Smart Countdown FX][2] version 0.9.5 or higher**, please do not forget to update before proceeding.

Up to two independent recurrence patterns can be defined. Supported patterns are:

* Daily - every day at a given time

* Weekly - every week on chosen week days (more than one day can be selected) at a given time

* Monthly - every month on a given date at a given time

* Yearly - every year on a given month and date at a given time

**Other features**

When configuring Smart Countdown FX or adding a shortcode to you post you can choose one of or both recirrence patterns defined in "Smart Countdown FX Easy Recurring Events" configuration. The opition to use both patterns will merge events from each recurrence into a single timeline. Of course you can merge any kind of patterns but mostly this feature serves for creating different schedules for week days and weekends in a combined "Weekly" pattern.

All events in a recurrence pattern have the same duration which can be set in "Duration" option in plugin configuration. When recurring events are imported the widget will show countdown to the next scheduled event and after event starts it will show "In progress" (or whatever title you set for "count up" mode) while event is in progress (i.e. during the interval set as "Duration"). After that the counter will automatically start countdown to the next event.
  
Overlapping events are also supported.

For samples and complete list of features [see this page][1]

 [1]: http://smartcalc.es/wp/index.php/2015/05/25/recurring-events/
 [2]: https://wordpress.org/plugins/smart-countdown-fx/

== Installation ==
Extract the zip file and just drop the contents in the wp-content/plugins/ directory of your WordPress installation and then activate the Plugin from Plugins page. Open "Settings" and configure recurrence pattern(s)

== Frequently Asked Questions ==
= How does one use the shortcode, exactly? =
Actually there is a single shortcode - "import_config".

<http://smartcalc.es/wp/index.php/2015/05/25/recurring-events/> - complete list of attribute values for this shortcode has been provided to answer this exact question.

= I have installed the plugin, but the counter doesn't appear in available widgets list. =
Do not forget to install and activate the main plugin - Smart Countdown FX.

= I have configured the widget but it is not displayed. =
Please, check "Counter display mode" setting in the widget options. If "Auto - both countdown and countup" is not selected, the widget might have been automatically hidden because the event is still in the future or already in the past. If you are using "Smart Countdown FX Easy Recurring Events" plugin check that "Import events from:" setting is correct. Then go to "Smart Countdown FX Easy Recurring Events" settings and make sure that recurrence pattern selected in "Import events from:" is not set to "Disabled".
**Linking a widget to a disabled recurrence pattern will hide the counter because no events will be found**

= I have inserted the countdown in a post, but it is not displayed. What's wrong? =
Check the spelling of "fx_preset" attribute (if you included it in attributes list). Try the standard fx_preset="Sliding_text_fade.xml". Also check "mode" attribute. Set in to "auto". If you are using "Smart Countdown FX Easy Recurring Events" plugin check that import_config attribute is correct, e.g.: import_config="scd_easy_recurrence::1" to use the first pattern. Then go to "Smart Countdown FX Easy Recurring Events" settings and make sure that recurrence pattern in Configuration 1 is not set to "Disabled".
**Linking a widget to a disabled recurrence pattern will hide the counter because no events will be found**

== Screenshots ==
1. Prepared to merge daily events for workdays, saturday and sunday

2. Only one monthly recurring pattern active

== Changelog ==

= 1.4 =

* Date validation improved for monthly and yearly recurrence patterns, e.g. now selecting "31" as a date for monthly repeat results in recurrence on the last day of each month.
* code optimization

= 1.3 =

* Added support for "countdown to event end" mode

= 1.2 =

* Event duration option added to plugin configuration.

= 1.1.0 =

* Plugin settings optimization. Old version settings will be automatically imported.

= 1.0.2 =

* Code optimization

= 1.0.1 =

* Bug fix - some UTC(+/-, e.g. UTC+1:30) time zones when selected in general site settings caused an error

= 1.0 =

* First release