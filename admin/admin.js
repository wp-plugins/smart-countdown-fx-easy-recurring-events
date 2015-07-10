/**
 * Admin interface enhacments
 */
jQuery(document).ready(function($) {
	/* currently not used
    jQuery('.hide-year.datepicker').datepicker({
        dateFormat : 'mm/dd',
        beforeShow: function(input, inst) {
        	inst.dpDiv.addClass('hide-year')
        }
    });
    */
    
    $('.scd-er-hide-control').on('change', function() {
    	var $this = $(this);
    	var value = $this.val();
    	var table = $this.closest('table');
    	table.find('.scd-er-hide').hide();
    	
    	table.find('.scd-day-select-desc').hide();
    	
    	switch(value) {
    	case 'daily' : 
    		table.find('.scd-er-time').show();
    		break;
    	case 'weekly' :
    		table.find('.scd-er-weekday').show();
    		table.find('.scd-er-time').show();
    		break;
    	case 'monthly' :
    		table.find('.scd-er-fulldate').show();
    		table.find('.scd-er-date').show();
    		table.find('.scd-er-time').show();
    		table.find('select.scd-day-select').children('option').removeAttr('disabled');
    		table.find('.scd-day-select-desc').show();
    		break;
    	case 'nthweekday' :
    		table.find('.scd-er-nthweekday').show();
    		table.find('.scd-er-time').show();
    		break;
   		case 'yearly' : 
    		table.find('.scd-er-fulldate').show();
    		table.find('.scd-er-month').show();
    		table.find('.scd-er-date').show();
    		table.find('.scd-er-time').show();
    		table.find('select.scd-day-select').children('option').removeAttr('disabled');
    		$('.scd-month-select').trigger('change');
    		break;
    			
    	default :
    		// disabled
    	};
    });
    $('.scd-er-hide-control').trigger('change');
    
    $('.scd-month-select').on('change', function() {
    	var month = $(this).val();
    	var date_select = $(this).closest('td').find('select.scd-day-select');
    	var date = date_select.val();
    	var date_options = date_select.children('option');
    	date_options.removeAttr('disabled');
    	if(!$(this).is(':visible')) {
    		// if month control is hidden we are in 'monthly' mode
    		// and there is no need to sanitize date selection
    		return;
    	}
    	if(month == 2) {
    		date_options.filter(function(){
    		    return ($(this).val() > 29);
    		}).attr('disabled', 'disabled');
    		if(date > 29) {
    			date_select.val(29);
    		}
    	} else if($.inArray(month, ["04", "06", "09", "11"]) != -1) {
    		date_options.filter(function(){
    		    return ($(this).val() > 30);
    		}).attr('disabled', 'disabled');
    		if(date > 30) {
    			date_select.val(30);
    		}
    	}
    });
    $('.scd-month-select').trigger('change');
});