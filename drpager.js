(function ($) {

Drupal.Drpager = {};

Drupal.behaviors.drpager = {
  attach: function(context, settings) {
      $(".drpager-page", context).bind('focus', function(e) {
        this.select();
        $(this).addClass('drpager-page-has-focus');
      })
      .bind('blur', function(e) {
        $(this).removeClass('drpager-page-has-focus');
      })
      .bind('keydown', function(e) {
        switch(e.keyCode) {
          case 13:
          case 10:   // iPhone <return>
            var self = $(this);
            var state = eval('(' + self.attr('name') + ');');
			if (state.display == 'pages') {
				var page = isNaN(self.val()) ? 0 : parseInt(self.val()) - 1;
				if (page < 0) {
				  page = 0;
				} else if (page >= state.total) {
				  page = state.total - 1;
				}
			} else {
				var item = isNaN(self.val()) ? 0 : parseInt(self.val()) - 1;
				if (item < 0) {
				  item = 0;
				} else if (item >= state.total) {
				  item = state.total - 1;
				}
				page = parseInt(item / parseInt(state.interval));
			}
            var viewContext = Drupal.Drpager.getAjaxViewContext(this);
            if (viewContext) {								// Views
              Drupal.Drpager.doAjaxView(self.next(), page, viewContext);
            } else if (window.Drupal.overlayChild) {		// Drupal admin overlay	
			  window.parent.jQuery.bbq.pushState({'overlay': state.url.replace(/drpagerpage/, page)});
			} else {										// Normal page
			  document.location = state.url.replace(/drpagerpage/, page);
			} 
            e.preventDefault();
            return false;
          case 38:    // up key
            Drupal.Drpager.pageStep(this, -1);
            return true;
          case 40:    // down key
            Drupal.Drpager.pageStep(this, 1);
            return true;
          case 33:    // page up
            Drupal.Drpager.pageStep(this, -5);
            return true;
          case 34:    // page down
            Drupal.Drpager.pageStep(this, 5);
            return true;
        }
      });
      // patch up first/previous/next/last link title attribute
      // if they are not set.
      $(".pager .pager-first a", context).each(function(){
        if (!this.title) {
          this.title = Drupal.t("Go to first page");
        }
      });
      $(".pager .pager-previous a", context).each(function(){
        if (!this.title) {
          this.title = Drupal.t("Go to previous page");
        }
      });
      $(".pager .pager-next a", context).each(function(){
        if (!this.title) {
          this.title = Drupal.t("Go to next page");
        }
      });
      $(".pager .pager-last a", context).each(function(){
        if (!this.title) {
          this.title = Drupal.t("Go to last page");
        }
      });      
  }
};

Drupal.Drpager.getAjaxViewContext = function(element) {
  if (Drupal.settings && Drupal.settings.views && Drupal.settings.views.ajaxViews) {
    for (i = 0 ; i < Drupal.settings.views.ajaxViews.length ; ++i) {
      var view = '.view-dom-id-' + Drupal.settings.views.ajaxViews[i].view_dom_id;
      var viewDiv = $(element).parents(view);
      if (viewDiv.size()) {
        return { target: viewDiv.get(0), settings: Drupal.settings.views.ajaxViews[i] };
      }
    }
    return false;
  } else {
    return false;
  }
};

Drupal.Drpager.doAjaxView = function(throbberElement, page, viewContext) {
  throbberElement.addClass('views-throbbing');
  var viewData = { 'js': 1, 'page': page };
  $.extend(
    viewData,
    viewContext.settings
  );
  var target = viewContext.target;
  //
  // copy from views/js/ajax_view.js
  //
  var ajax_path = Drupal.settings.views.ajax_path;
  // If there are multiple views this might've ended up showing up multiple times.
  if (ajax_path.constructor.toString().indexOf("Array") != -1) {
    ajax_path = ajax_path[0];
  }
  $.ajax({
    url: ajax_path,
    type: 'GET',
    data: viewData,
    success: function(response) {
      throbberElement.removeClass('views-throbbing');
      // Scroll to the top of the view. This will allow users
      // to browse newly loaded content after e.g. clicking a pager
      // link.
      var offset = $(target).offset();
      // We can't guarantee that the scrollable object should be
      // the body, as the view could be embedded in something
      // more complex such as a modal popup. Recurse up the DOM
      // and scroll the first element that has a non-zero top.
      var scrollTarget = target;
      while ($(scrollTarget).scrollTop() == 0 && $(scrollTarget).parent()) {
        scrollTarget = $(scrollTarget).parent()
      }
      // Only scroll upward
      if (offset.top - 10 < $(scrollTarget).scrollTop()) {
        $(scrollTarget).animate({scrollTop: (offset.top - 10)}, 500);
      }
      // Call all callbacks.
      if (response.__callbacks) {
        $.each(response.__callbacks, function(i, callback) {
          eval(callback)(target, response);
        });
      }
    },
    error: function(xhr) { throbberElement.removeClass('views-throbbing'); Drupal.Views.Ajax.handleErrors(xhr, ajax_path); },
    dataType: 'json'
  });
};

Drupal.Drpager.pageStep = function(el, step) {
  var self = $(el);
  var state = eval('(' + self.attr('name') + ');');
  var page = isNaN(self.val()) ? 1 : parseInt(self.val());
  page += step * state.interval;
  if (page < 1) {
    page = 1;
  } else if (page > state.total){
    page = state.total;
  }
  self.val(page);
};

})(jQuery);