/**
 * 
 */
(function($) {

  var httpCgiPath = "/cs/idcplg";

  // copy from global scope
  if (typeof window.httpCgiPath !== "undefined") {
    httpCgiPath = window.httpCgiPath;
  }

  var defaultOptions = {
    url : httpCgiPath,
    dataType : "json",
    data : {
      IsJson : 1
    }
  };

  $.extend({
    ucm : {

      /**
       * Executes a ucm ajax call so that the error handler will be invoked when
       * the UCM service indicated an error.
       */
      ajax : function(opts) {

        if (typeof opts.success === "function" && typeof opts.error === "function") {

          // augment success callback to handle error case
          var successHandler = opts.success;
          var errorHandler = opts.error;

          opts.success = function(data, textStatus, xhr) {

            // if error
            if (typeof data.LocalData.StatusMessage !== "undefined" && data.LocalData.StatusMessage !== "") {
              var message = data.LocalData.StatusMessage;

              errorHandler.call(null, xhr, message);
              return;
            }

            successHandler.call(null, data, textStatus, xhr);
          };

        }

        var options = $.extend(true, {}, defaultOptions, opts);

        return jQuery.ajax(options);
      },

      /**
       * Executes a JSON service call.
       */
      service : function(serviceName, data, success, error, complete) {
        var options = {};
        options.data = data || {};
        options.data.IdcService = serviceName;

        if (typeof success !== "undefined") {
          options.success = success;
        }

        if (typeof error !== "undefined") {
          options.error = error;
        }

        if (typeof complete !== "undefined") {
          options.complete = complete;
        }

        return jQuery.ucm.ajax(options);
      },

      /**
       * Executes a UCM search query.
       */
      search : function(queryData, success, error, complete) {

        return jQuery.ucm.service("GET_SEARCH_RESULTS", queryData, success, error, complete);
      }
    }
  });

})(jQuery);