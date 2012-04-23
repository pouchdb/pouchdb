//Futon in one file 
//inpired on mobilefuton (git://github.com/daleharvey/mobilefuton.git)

(function($){
	var PutonClass = function(el){
		var self = this;
		this.$el = $(el);
		
		this.init = function() {
			console.log(self);
			console.log(self.$el);
			self.createUi();
		}

		// Attach the instance of this object
		// to the jQuery wrapped DOM node
		this.$el.data('Puton', this);
		this.init();
	}
	
	PutonClass.prototype.showAllDbs = function() {
		console.log(
			window.webkitIndexedDB.getDatabaseNames()
		);
	};
		
	PutonClass.prototype.tpl = {

	    // Hash of preloaded templates for the app
	    templates: {},

	    // Recursively pre-load all the templates for the app.
	    // This implementation should be changed in a production environment:
	    // All the template files should be concatenated in a single file.
	    loadTemplates: function(names, callback) {

	        var self = this;

	        var loadTemplate = function(index) {
	            var name = names[index];
//	            console.log('Loading template: ' + name);
				
				var path = PutonClass.prototype.option.pathPuton;
				
	            $.get(path + '/tpl/' + name + '.html', function(data) {
	                self.templates[name] = data;
	                index++;
	                if (index < names.length) {
	                    loadTemplate(index);
	                } else {
	                    callback();
	                }
	            });
	        }

	        loadTemplate(0);
	    },

	    // Get template by name from hash of preloaded templates
	    get: function(name) {
	        return this.templates[name];
	    }

	};
	
	PutonClass.prototype.setTemplates = function() {
		var self = this;
		
		this.tpl.loadTemplates(['changes_tpl', 'config_section_tpl', 'config_top_tpl', 'confirm_tpl', 'couchapps_tpl', 'create_doc_tpl', 'database_tpl', 'database_view_tpl', 'databases_tpl', 'document_tpl', 'edit_key_tpl', 'home_tpl', 'logged_in', 'logged_in_btn', 'logged_out', 'logged_out_btn', 'replication_doc_tpl', 'replication_items', 'replication_tpl', 'tasks_tpl', 'unauthorized_tpl'], function() {
		  //  console.log(self.tpl.templates);
		});
	
	};
		
	PutonClass.prototype.createUi = function() {
		this.setTemplates();
		this.$el.html('<div id="dbs">xxx</div>');
	};
 
	$.fn.Puton = function(options){
		
		PutonClass.prototype.option = options;

		return this.each(function(){
			(new PutonClass(this));
		});
	}
 
})(jQuery);
