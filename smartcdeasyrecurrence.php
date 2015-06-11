<?php
/*
 * Plugin Name: Smart Countdown FX Easy Recurring Events
 * Text Domain: smart-countdown-easy-recurrence
 * Domain Path: /languages
 * Plugin URI: http://smartcalc.es/wp
 * Description: This plugin adds basic recurring events to Smart Cowntdown FX.
 * Version: 1.2
 * Author: Alex Polonski
 * Author URI: http://smartcalc.es/wp
 * License: GPL2
 */

defined( 'ABSPATH' ) or die();

final class SmartCountdownEasyRecurrence_Plugin {
	private static $instance = null;
	
	private static $options_page_slug = 'scd-easy-recurrence-settings';
	public static $option_prefix = 'scd_easy_recurrence_settings_';
	private static $text_domain = 'smart-countdown-easy-recurrence';
	public static $provider_alias = 'scd_easy_recurrence';
	public static $provider_name;
	
	private static $defaults = array(
			'title' => '',
			'pattern' => '',
			'month' => '',
			'date' => '',
			'weekdays' => array(),
			'hour' => '',
			'minute' => '',
			'duration' => '0:00'
	);
	
	public static function get_instance() {
		if( is_null( self::$instance) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}
	
	private function __construct() {
		
		require_once( dirname( __FILE__ ) . '/includes/helper.php');
		
		load_plugin_textdomain( 'smart-countdown-easy-recurrence', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
		
		add_action( 'admin_init', array( $this, 'register_my_settings' ) );
		
		add_action( 'admin_menu', array( $this, 'add_my_menu' ) );
		
		add_action( 'plugin_action_links_' . plugin_basename(__FILE__), array( $this, 'add_plugin_actions' ) );
		
		add_filter( 'smartcountdownfx_get_event',  array( $this, 'get_current_events'), 10, 2 );
		
		add_filter( 'smartcountdownfx_get_import_configs',  array( $this, 'get_configs') );
		
		self::$provider_name = __( 'Easy recurring', self::$text_domain );
		
		add_action( 'admin_enqueue_scripts', array (
				$this,
				'admin_scripts'
		) );
	}
	
	public static function admin_scripts() {
		$plugin_url = plugins_url() . '/' . dirname( plugin_basename( __FILE__ ) );
		
		/* we will uncomment this block if we decide to use date picker for
		 * recurrence start and end dates
		wp_enqueue_script( 'jquery-ui' );
		wp_enqueue_script( 'jquery-ui-datepicker' );
		wp_register_style( 'jquery-ui-css', $plugin_url . '/admin/jquery-ui.css' );
		wp_enqueue_style( 'jquery-ui-css' );
		wp_register_style( 'ui-override', $plugin_url . '/admin/ui-override.css' );
		wp_enqueue_style( 'ui-override' );
		*/
		
		wp_register_script( self::$provider_alias . '_script', $plugin_url . '/admin/admin.js', array( 'jquery' ) );
		wp_enqueue_script( self::$provider_alias . '_script' );
	}
	public function add_my_menu() {
		add_options_page( __( 'Smart Countdown FX Easy Recurring Events Settings', self::$text_domain ), __( 'Easy Recurring Events', self::$text_domain ), 'administrator', self::$options_page_slug, array( $this, 'add_plugin_options_page' ) );
	}
	
	public function register_my_settings() {
		self::registerSettings(1);
		self::registerSettings(2);
	}
	
	public function add_plugin_options_page() {
?>
		<div class="wrap">
		<h2><?php _e( 'Smart Countdown FX Easy Recurring Events Settings', self::$text_domain ); ?></h2>
				 
			<form method="post" action="options.php">
				<?php settings_fields( self::$options_page_slug ); ?>
				<?php do_settings_sections( self::$options_page_slug ); ?>
				<table class="form-table">
					<?php echo self::displaySettings(1); ?>
				</table>
				<hr />
				<table class="form-table">
					<?php echo self::displaySettings(2); ?>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
<?php
	}
	
	public function add_plugin_actions( $links ) {
		$new_links = array();
		$new_links[] = '<a href="options-general.php?page=' . self::$options_page_slug . '">' . __( 'Settings' ) . '</a>';
		return array_merge( $new_links, $links );
	}
	
	public function get_current_events( $instance ) {
		$active_config = $instance['import_config'];
		if( empty( $active_config ) ) {
			return $instance;
		}
		
		$parts = explode( '::', $active_config );
		if( $parts[0] != self::$provider_alias ) {
			return $instance;
		}
		array_shift($parts);
		
		$configs = array();
		foreach( $parts as $preset_index ) {
			$configs[] = self::getOptions( $preset_index );
		}
		
		return SmartCountdownEasyRecurring_Helper::getEvents( $instance, $configs );
	}
	
	public function get_configs( $configs ) {
		return array_merge( $configs, array(
				self::$provider_name => array(
						self::$provider_alias . '::1' => self::getTitle( 1 ),
						self::$provider_alias . '::2' => self::getTitle( 2 ),
						self::$provider_alias . '::1::2' => self::$provider_name . ': ' . __( 'Merge configurations',  self::$text_domain )
				)
		) );
	}
	private static function getTitle( $preset_index ) {
		$options = self::getOptions( $preset_index );
		return !empty( $options['title'] ) ? $options['title'] : __( 'Untitled' );
	}
	private static function registerSettings( $preset_index ) {
		register_setting( self::$options_page_slug, self::$option_prefix . $preset_index,  'SmartCountdownEasyRecurrence_Plugin::validateSettings' );
		// check if new settings were saved before
		$settings = get_option( self::$option_prefix . $preset_index, false );
		if( !is_array( $settings ) ) {
			// missing new settings, try to transfer settings to new format
			$options = self::getDeprecatedOptions( $preset_index );
			update_option( self::$option_prefix . $preset_index, $options );
			// delete deprecated options
			self::deleteDeprecatedOptions( $preset_index );
		}
	}
	
	public static function validateSettings( $input )
	{
		foreach( self::$defaults as $key => $value ) {
			if( empty( $input[$key] ) ) {
				$input[$key] = $value;
			}
			if( $key == 'title' ) {
				if( trim( $input[$key] ) == '' ) {
					$input[$key] = __( 'Untitled' );
				}
				$input[$key] = strip_tags( $input[$key] );
			}
			if( $key == 'duration' ) {
				$hm = explode( ':', $input['duration'] );
				if( count( $hm ) != 2 ) {
					$hm = array( '0', '00');
				} else {
					$hm[0] = ( int ) $hm[0];
					$hm[1] = ( int ) $hm[1];
					if( $hm[1] < 0 || $hm[1] > 59 ) {
						$hm[1] = 0;
					}
					if( $hm[0] < 0 || $hm[0] > 23 ) {
						$hm[0] = 0;
					}
					$hm[1] = str_pad( $hm[1], 2, '0', STR_PAD_LEFT );
				}
				$input['duration'] = implode( ':', $hm );
			}
		}
		return $input;
	}
	
	private static function getOptions( $preset_index ) {
		$options = get_option( self::$option_prefix . $preset_index, array() );
		if( empty( $options ) ) {
			// new version settings were never saved. Fallback to old version settings
			$options = self::getDeprecatedOptions( $preset_index );
		}
		foreach( self::$defaults as $key => $value ) {
			if( empty( $options[$key] ) ) {
				$options[$key] = $value;
			}
		}
		return $options;
	}
	
	private static function getDeprecatedOptions( $preset_index ) {
		$options = array();
		foreach( self::$defaults as $key => $default ) {
			$options[$key] = get_option( self::$option_prefix . $key . '_' . $preset_index, $default );
		}
		return $options;
	}
	
	private static function displaySettings( $preset_index ) {
		$options = self::getOptions( $preset_index );
		
		ob_start();
		?>
			<tr>
				<th colspan="2"><h4><?php _e( 'Configuration', self::$text_domain ); ?> <?php echo $preset_index; ?></h4></th>
			</tr>
			<tr valign="top">
				<th scope="row"><label for="<?php echo self::$option_prefix; ?>title_<?php echo $preset_index; ?>"><?php _e( 'Title' ); ?></label></th>
				<td>
					<input type="text" class="regular-text" name="<?php echo self::$option_prefix . $preset_index; ?>[title]" value="<?php echo esc_attr( $options['title'] ); ?>" />
					<p class="description"><?php _e( 'This title will appear in available event import profiles list in Smart Countdown FX configuration', self::$text_domain ); ?></p>
				</td>
			</tr>
			<tr valign="top">
				<th scope="row"><label for="<?php echo self::$option_prefix; ?>pattern_<?php echo $preset_index; ?>"><?php _e('Recurrence pattern', self::$text_domain); ?></label></th>
				<td>
					<?php echo SmartCountdownEasyRecurring_Helper::selectInput(self::$option_prefix . 'pattern_' . $preset_index, self::$option_prefix . $preset_index . '[pattern]', $options['pattern'], array(
						'options' => array(
							'' => __('Disabled', self::$text_domain),
							'daily' => __('Daily', self::$text_domain),
							'weekly' => __('Weekly', self::$text_domain),
							'monthly' => __('Monthly', self::$text_domain),
							'yearly' => __('Yearly', self::$text_domain)
						),
						'type' => 'optgroups',
						'class' => 'scd-er-hide-control'
					)); ?>
				</td>
			</tr>
			<tr valign="top" class="scd-er-hide scd-er-fulldate">
				<th scope="row"><label for="<?php echo self::$option_prefix; ?>date_<?php echo $preset_index; ?>"><?php _e( 'Date' ); ?></label></th>
				<td>
					<span class="scd-er-hide scd-er-month">
						<label for="<?php echo self::$option_prefix; ?>hour_<?php echo $preset_index; ?>"><?php _e( 'Month' ); ?></label>
						<?php echo SmartCountdownEasyRecurring_Helper::selectInput(self::$option_prefix . 'month_' . $preset_index, self::$option_prefix . $preset_index . '[month]', $options['month'], array(
							'options' => array(
									1 => __( 'January' ),
									2 => __( 'February' ),
									3 => __( 'March' ),
									4 => __( 'April' ),
									5 => __( 'May' ),
									6 => __( 'June' ),
									7 => __( 'July' ),
									8 => __( 'August' ),
									9 => __( 'September' ),
									10 => __( 'October' ),
									11 => __( 'November' ),
									12 => __( 'December' )
							),
							'type' => 'optgroups'
						)); ?>&nbsp;
					</span>
					<span class="scd-er-hide scd-er-date">
						<label for="<?php echo self::$option_prefix; ?>minute_<?php echo $preset_index; ?>"><?php _e( 'Day' ); ?></label>
						<?php echo SmartCountdownEasyRecurring_Helper::selectInput(self::$option_prefix . 'date_' . $preset_index, self::$option_prefix . $preset_index . '[date]', $options['date'], array(
							'start' => 1,
							'end' => 31,
							'step' => 1,
							'type' => 'integer'
						)); ?>
					</span>
				</td>
			</tr>
			<tr valign="top" class="scd-er-hide scd-er-weekday">
				<th scope="row"><label><?php _e('Week days', self::$text_domain); ?></label></th>
				<td>
					<?php echo SmartCountdownEasyRecurring_Helper::checkboxesInput(self::$option_prefix . 'weekdays_' . $preset_index, self::$option_prefix . $preset_index . '[weekdays]', $options['weekdays'], array(
						'options' => array(
								'0' => __( 'Sunday' ),
								'1' => __( 'Monday' ),
								'2' => __( 'Tuesday' ),
								'3' => __( 'Wednesday' ),
								'4' => __( 'Thursday' ),
								'5' => __( 'Friday' ),
								'6' => __( 'Saturday' )
						)
					)); ?>
					<p class="description"><?php _e( 'Select week days when event takes place. Selecting all will result in "Daily" recurrence. Selecting none will disable recurrence.', self::$text_domain ); ?></p>
				</td>
			</tr>
			<tr valign="top" class="scd-er-hide scd-er-time">
				<th scope="row"><label for="<?php echo self::$option_prefix; ?>hour_<?php echo $preset_index; ?>"><?php _e( 'Time', self::$text_domain ); ?></label></th>
				<td>
					<label for="<?php echo self::$option_prefix; ?>hour_<?php echo $preset_index; ?>"><?php _e( 'Hours', self::$text_domain ); ?></label>
					<?php echo SmartCountdownEasyRecurring_Helper::selectInput(self::$option_prefix . 'hour_' . $preset_index, self::$option_prefix . $preset_index . '[hour]', $options['hour'], array(
						'start' => 0,
						'end' => 23,
						'step' => 1,
						'type' => 'integer'
					)); ?>&nbsp;
					<label for="<?php echo self::$option_prefix; ?>minute_<?php echo $preset_index; ?>"><?php _e( 'Minutes', self::$text_domain ); ?></label>
					<?php echo SmartCountdownEasyRecurring_Helper::selectInput(self::$option_prefix . 'minute_' . $preset_index, self::$option_prefix . $preset_index . '[minute]', $options['minute'], array(
						'start' => 0,
						'end' => 59,
						'step' => 1,
						'type' => 'integer'
					)); ?>
				</td>
			</tr>
			<tr valign="top" class="scd-er-hide scd-er-time">
				<th scope="row"><label for="<?php echo self::$option_prefix; ?>duration_<?php echo $preset_index; ?>"><?php _e( 'Duration (hh:mm)' ); ?></label></th>
				<td>
					<input type="text" class="small-text textright" name="<?php echo self::$option_prefix . $preset_index; ?>[duration]" value="<?php echo esc_attr( $options['duration'] ); ?>" />
					<p class="description"><?php _e( 'Enter event duration in "hours:minutes" format, e.g. 2:30 for two hours and a half. Allowed range: 0:00 - 23:59.', self::$text_domain ); ?></p>
				</td>
			</tr>
	<?php
		return ob_get_clean();
	}
	
	public static function deleteDeprecatedOptions( $preset_index ) {
		foreach( array( 'title_', 'pattern_', 'weekdays_', 'month_', 'date_', 'hour_', 'minute_' ) as $option_name ) {
			delete_option( SmartCountdownEasyRecurrence_Plugin::$option_prefix . $option_name. $preset_index );
			delete_site_option( SmartCountdownEasyRecurrence_Plugin::$option_prefix . $option_name. $preset_index );
		}
	}
}

SmartCountdownEasyRecurrence_Plugin::get_instance();

function smartcountdown_easy_recurring_events_uninstall() {
	foreach( array( 1, 2 ) as $preset_index ) {
		// just in case old version is uninstalled, delete deprecated options
		SmartCountdownEasyRecurrence_Plugin::deleteDeprecatedOptions( $preset_index );
		// delete options
		delete_option( SmartCountdownEasyRecurrence_Plugin::$option_prefix . $preset_index );
		delete_site_option( SmartCountdownEasyRecurrence_Plugin::$option_prefix . $preset_index );
	}
}
register_uninstall_hook( __FILE__, 'smartcountdown_easy_recurring_events_uninstall' );
