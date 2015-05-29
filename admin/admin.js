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
    		break;
   		case 'yearly' : 
    		table.find('.scd-er-fulldate').show();
    		table.find('.scd-er-month').show();
    		table.find('.scd-er-date').show();
    		table.find('.scd-er-time').show();
    		break;
    			
    	default :
    		// disabled
    	};
    });
    $('.scd-er-hide-control').trigger('change');
});