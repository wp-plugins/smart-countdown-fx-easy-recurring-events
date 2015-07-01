=== Smart Countdown FX ===
Contributors: alex3493 
Tags: countdown, counter, count down, timer, event, widget, years, months, FX, animated, responsive, recurring
Requires at least: 3.6
Tested up to: 4.2.2
Stable tag: 1.2.3
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Smart Countdown FX displays a responsive animated countdown. Supports years and months display and recurring events

== Description ==
Smart Countdown FX key features:

* years and months (along with “traditional” weeks, days, hours, minutes and seconds) can be displayed in the countdown interval.

* counter digits changes are animated and site administrator can easily switch between available [animation profiles][2], included with the plugin or added later.
  
* event [import plugins][3] support, no need to manually edit widget settings or shortcode for recurring or calendar events. 

**Other features**

Smart Countdown FX can show both countdown and count up counters, and it will switch to the “count up” mode automatically when the event time arrives. Event description can be configured individually for countdown and count up modes and can containt HTML markup allowed for a post.

Smart Countdown FX supports different layouts. Most popular layouts (sidebar, shortcode, shortcode compact, etc.) are included in the package and can be selected in the widget options or using a shortcode attribute. Custom layout presets can be easily created using existing ones as a starting point. You will find detailed instructions in the documentation..

Smart Countdown FX widget is responsive. Open "Responsive" page on different handheld devices or just change your browser window width if you are on a desktop to see the feature in action.

More than one countdown can be displayed on the same page, each instance with its individual settings and configuration.

Events import plugins are supported.

[Project home page][1]

**Coming soon**

* More event import plugins for popular event management plugins and services.

* More animation profiles.

 [1]: http://smartcalc.es/wp/
 [2]: http://smartcalc.es/wp/index.php/category/animation-profiles/
 [3]: http://smartcalc.es/wp/index.php/category/event-import-plugins/

== Installation ==
Extract the zip file and just drop the contents in the wp-content/plugins/ directory of your WordPress installation and then activate the Plugin from Plugins page.

== Frequently Asked Questions ==
= How does one use the shortcode, exactly? =
<http://smartcalc.es/wp/index.php/reference/> - complete list of shortcode attributes has been provided to answer this exact question.

= How can I add new animation effects? =
<http://smartcalc.es/wp/index.php/installing-more-animations/> - detailed instructions on installing additional animation profiles.

= I have installed the plugin, but Smart Countdown FX doesn't appear in available widgets list. =
Do not forget to active the plugin after installation.

= I have configured the widget but it is not displayed. =
Please, check "Counter display mode" setting in the widget options. If "Auto - both countdown and countup" is not selected, the widget might have been automatically hidden because the event is still in the future or already in the past.

= I have inserted the countdown in a post, but it is not displayed. What's wrong? =
Check the spelling of "fx_preset" attribute (if you includeded it in attributes list). Try the standard fx_preset="Sliding_text_fade.xml". Also check "mode" attribute. Set in to "auto".

== Screenshots ==
1. Widget settings

2. Widget in sidebar (custom animation)

3. HTML Countdown in front end

4. "Time has arrived!" message

== Changelog ==

= 1.2.3 =

* added support for event import plugins which implement "countdown to event end" feature
* Fixed CSS bug that erroneousely changed layout on new counter unit display (e.g. when count up crosses 1 minute value)
* better clock sync on next event query (for event import plugins support)

= 1.2.2 =

* responsive behavior refactored
* flexible suspend detection threshold - improved stability on slow devices

= 1.1.2 =

* frontend translations added for French, German and Italian
* line-height in event titles fixed in responsive behavior

= 1.1 =

* suspend/resume detection threshold set to a greater value - improves counter stability on mobile devices

= 1.0.1 = 

* fixed bug - switching tabs in Firefox and Chrome caused issues in some complex animations. Currently published animation profiles were not affected but it is recommended to update anyway.

= 1.0.0 = 

* fixed automatic update issue. Now additional animation profiles can be installed in a dedicated folder outside the plugin's directory and are not deleted on automatic plugin update.

= 0.9.9 = 

* bug fix - imported overlapping events were not placed in queue correctly in some cases
* compatibility - some themes set font-size for all div elements in style sheet. It caused incorrect digits display. Now this issue is fixed.

= 0.9.8 = 

* event import plugins support - bug fixes
* added "%imported%" placeholder support in event titles

= 0.9.7 = 

* added custom styles shortcode attributes

= 0.9.6 =

* bug fixes

= 0.9.5 =

* support for Event import plugins
* bug fixes

= 0.9 =

* First release

== Upgrade Notice ==

Please upgrade to at least 0.9.5 in order to be able to use event import plugins (upgrade to the latest version is always recommended)
