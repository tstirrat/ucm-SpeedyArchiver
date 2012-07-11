/*
 * Copyright 2012 Tim Stirrat, Vedran Stanic
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
$(document).ready(
    function() {

      $('#edit-query-form').submit(function(e) {
        e.preventDefault();

        if ($('#edit-query-form-valid').val() == "1") {

          // get the correct format for the aExportQuery field
          $('#aExportQuery').val(calculateExportQuery());

          var archiveName = $('#edit-archivedata-form input.archive-name').val();
          var statusArea = $('#status-' + archiveName);

          var form = $('#edit-archivedata-form');

          // console.log(form.serialize());

          $.ajax({
            type : 'POST',
            url : form.attr('action'),
            data : form.serialize(),
            success : function(data, textStatus) {
              statusArea.text('Export query updated');
            },
            error : function(data) {
              statusArea.html('<span class="xuiError">There was a problem editing the export query</span>');
            },
            dataType : 'json'
          });

        } // if valid

      });

      $('.actions a.edit-query').click(function(e) {

        var archiveName = $(this).closest('div').attr('id');

        $('#edit-query-dialog span.archive-name').text(archiveName);
        $('#edit-archivedata-form input.archive-name').val(archiveName);
        $('#edit-query-form').show();
        $('#edit-query-wait').hide();

        $('#edit-query-dialog').dialog('open');

        // hide the form until the config has been retrieved
        // $('#edit-query-form').hide();
        // $('#edit-query-form textarea, #edit-query-form
        // input').attr('disabled', 'disabled');

        $('#CustomQuery').val('Loading export query for ' + archiveName);

        // GET_ARCHIVES
        $.ajax({
          type : 'POST',
          url : $('#get-archives-form').attr('action'),
          data : $('#get-archives-form').serialize(),
          success : function(data, textStatus) {
            // refresh all archive data
            processArchiveData(data);

            // load this export query data into the form
            if (loadExportQuery(archiveName)) {
              // show the form
              // $('#edit-query-form').show();
              // $('#edit-query-wait').hide();
              // $('#edit-query-form textarea, #edit-query-form
              // input').removeAttr('disabled');
            } else {
              $('#edit-query-wait').text('Error reading export query for ' + archiveName);
              $('#edit-query-wait').show();
              $('#edit-query-form').hide();
            }

          },
          error : function(data) {
            $('#edit-query-wait').text('Unable to get archive data for ' + archiveName);
            $('#edit-query-wait').show();
            $('#edit-query-form').hide();

          },
          dataType : 'json'
        });

        e.preventDefault();
      });

      $('.actions a.import-action').click(function(e) {
        e.preventDefault();

        var archiveName = $(this).attr('rel');

        $('#form-import-archive').find('input[name=aArchiveName]').val(archiveName);

        importArchive();

      });

      var importArchive = function(archiveName) {
        var form = $('#form-import-archive');

        var statusArea = $('#status-' + archiveName);

        statusArea.text('Requesting import...');

        $.ajax({
          type : 'POST',
          url : form.attr('action'),
          data : form.serialize(),
          success : function(data, textStatus) {
            statusArea.text('Import for archive "' + archiveName + '" started');
          },
          error : function(data) {
            statusArea.html('<span class="xuiError">There was a problem executing the import</span>');
          },
          dataType : 'json'
        });

      };

      $('.actions a.export-action').click(
          function(e) {
            var archiveName = $(this).attr('rel');

            // populate forms
            $('#form-get-batchfiles').find('input[name=aArchiveName]').val(archiveName);
            $('#form-delete-batch').find('input[name=aArchiveName]').val(archiveName);
            $('#form-export-archive').find('input[name=aArchiveName]').val(archiveName);

            $("#dialog-export").dialog('widget').find("button:contains('OK') .ui-button-text").text('Cancel');
            $("#dialog-export").dialog('widget').find("button:contains('Export')").removeAttr('disabled').removeClass(
                'ui-state-disabled').show();

            $('#dialog-export').dialog('open');
            e.preventDefault();
          });

      $('.actions a.batch-action').click(
          function(e) {
            var archiveName = $(this).attr('rel');

            // populate forms
            $('#form-get-batchfiles').find('input[name=aArchiveName]').val(archiveName);
            $('#form-delete-batch').find('input[name=aArchiveName]').val(archiveName);
            $('#form-import-batch').find('input[name=aArchiveName]').val(archiveName);

            $('#dialog-view-batches').dialog('open');

            var form = $('#form-get-batchfiles');

            $.ajax({
              type : 'POST',
              url : form.attr('action'),
              data : form.serialize(),
              success : function(data, textStatus) {
                $('#dialog-view-batches-list').children().remove();

                if (typeof data.ResultSets.BatchFiles !== "undefined") {
                  var BatchFiles = data.ResultSets.BatchFiles.rows;

                  for ( var i = 0; i < BatchFiles.length; i++) {

                    var trimmedName = BatchFiles[i][0];
                    trimmedName = trimmedName.substring(0, trimmedName.indexOf("/"));

                    var name = $(document.createElement('td')).text(trimmedName);
                    var count = $(document.createElement('td')).text(BatchFiles[i][3]);
                    var state = $(document.createElement('td')).text(BatchFiles[i][1]);

                    $(document.createElement('tr')).data('filepath', BatchFiles[i][0]).append(name).append(count)
                        .append(state).appendTo('#dialog-view-batches-list');
                  }
                }
              },
              dataType : 'json'
            });

            e.preventDefault();
          });

      /**
       * Exports the archive. forms are pre-populated.
       */
      var exportArchive = function() {

        var form = $('#form-get-batchfiles');

        var archiveName = form.find("input[name=aArchiveName]").val();

        var statusArea = $('#dialog-export-status, #status-' + archiveName);

        // disable export button
        $("#dialog-export-options").hide();
        $("#dialog-export").dialog('widget').find("button:contains('Export')").attr('disabled', 'disabled').addClass(
            'ui-state-disabled');
        $("#dialog-export").dialog('widget').find("button:contains('Cancel')").attr('disabled', 'disabled').addClass(
            'ui-state-disabled');

        // clear old batch files?
        if ($('#delete-old-archives').is(':checked')) {
          statusArea.text('Enumerating batch files...');

          var BatchFiles;

          $.ajax({
            async : false,
            type : 'POST',
            url : form.attr('action'),
            data : form.serialize(),
            success : function(data, textStatus) {
              if (data.ResultSets.BatchFiles.rows != null) {
                BatchFiles = data.ResultSets.BatchFiles.rows;
              }
            },
            dataType : 'json'
          });

          // remove each batch file if any
          if (BatchFiles != null) {
            if (BatchFiles.length > 0) {
              var errorCount = 0;
              var successCount = 0;

              statusArea.text('Removing old batch files...');

              form = $('#form-delete-batch');

              for ( var i = 0; i < BatchFiles.length; i++) {
                form.find('input[name=aBatchFile]').val(BatchFiles[i][0]);

                $.ajax({
                  async : false,
                  type : 'POST',
                  url : form.attr('action'),
                  data : form.serialize(),
                  success : function(data, textStatus) {
                    successCount++;
                  },
                  error : function(data) {
                    errorCount++;
                  },
                  dataType : 'json'
                });
              }
            }
          }
        }

        statusArea.text('Exporting...');

        form = $('#form-export-archive');

        statusArea.text('Requesting export...');

        $.ajax({
          type : 'POST',
          url : form.attr('action'),
          data : form.serialize(),
          success : function(data, textStatus) {
            statusArea.text('Export started');

            $("#dialog-export").dialog('widget').find("button:contains('Export')").hide();
            $("#dialog-export").dialog('widget').find("button:contains('Cancel')").removeAttr('disabled').removeClass(
                'ui-state-disabled').find(".ui-button-text").text('OK');
          },
          error : function(data) {
            statusArea.html('<span class="xuiError">There was a problem executing the export</span>');
          },
          dataType : 'json'
        });
      };

      $('a.refresh').click(function(e) {
        e.preventDefault();

        var archiveName = $(this).attr("rel");
        $.ucm.service("SPEEDY_GET_ARCHIVE_INFO", {
          aArchiveName : archiveName
        }, function(data) {
          if (data.LocalData.aTotalLastExported) {
            $("#exported-" + archiveName).text(data.LocalData.aTotalLastExported);
          }

          if (data.LocalData.aTotalLastImported) {
            $("#imported-" + archiveName).text(data.LocalData.aTotalLastImported);
          }
        })
      });

      /**
       * Turns the visual form into a the archivedata parameter aExportQuery
       */
      var calculateExportQuery = function() {
        var fieldValue = "Standard Query	ValuePanel 	";
        var tempVal = "";

        tempVal = $('#UseExportDate').is(':checked') ? '1' : '0';
        fieldValue += "UseExportDate " + tempVal + "	";

        tempVal = $('#AllowExportPublished').is(':checked') ? '1' : '0';
        fieldValue += "AllowExportPublished " + tempVal + "	";

        tempVal = $('#AllRevisions').is(':checked') ? '1' : '0';
        fieldValue += "AllRevisions " + tempVal + "	";

        tempVal = $('#LatestRevisions').is(':checked') ? '1' : '0';
        fieldValue += "LatestRevisions " + tempVal + "	";

        tempVal = $('#NotLatestRevisions').is(':checked') ? '1' : '0';
        fieldValue += "NotLatestRevisions " + tempVal + "	";

        tempVal = $('#MostRecentMatching').is(':checked') ? '1' : '0';
        fieldValue += "MostRecentMatching " + tempVal + "	";

        // TODO: clauses logic, prob not neccesary
        tempVal = "";
        fieldValue += "CurrentIndex -1	Clauses " + tempVal + "	";

        tempVal = escapeExportQuery();
        fieldValue += "CustomQuery " + tempVal + "	";

        /*
         * / custom query always enabled for now tempVal =
         * $('#IsCustom').is(':checked') ? '1' : '0'; fieldValue += "IsCustom " +
         * tempVal;
         */

        fieldValue += "IsCustom 1";

        // console.log(fieldValue);

        return fieldValue;
      }

      /**
       * Escapes the export query as is required
       */
      var escapeExportQuery = function() {
        var QueryText = $('#CustomQuery').val();

        // console.log(QueryText);

        QueryText = QueryText.replace(/%/g, "#%"); // % = #%
        QueryText = QueryText.replace(/ /g, "%"); // whitespace = %

        // console.log(QueryText);

        return QueryText;
      }

      /**
       * Unescapes the export query as is required
       */
      var unescapeExportQuery = function(QueryText) {
        // console.log(QueryText);

        // doesnt suport look behind :/ or this would work: (?<!\\)(\\r)?\\n/g

        // so this hack will work *sigh*
        QueryText = QueryText.replace(/\\\\/g, "!!");

        QueryText = QueryText.replace(/(\\r)?\\n/g, "\n");

        QueryText = QueryText.replace(/!!/g, "\\");

        QueryText = QueryText.replace(/\\\\/g, "\\");
        QueryText = QueryText.replace(/%/g, " ");
        QueryText = QueryText.replace(/# /g, "%");

        // console.log(QueryText);

        return QueryText;
      }

      /**
       * Loads all archive data settings into the respective rows.
       */
      var processArchiveData = function(data) {
        if (data.ResultSets.ArchiveData && data.ResultSets.ArchiveData.rows.length > 0) {
          var archives = data.ResultSets.ArchiveData.rows;

          for ( var i = 0; i < archives.length; i++) {
            // put the archive config into the input.config element (hidden)
            $('#' + archives[i][0]).find('input.config').val(archives[i][2]);
          }
        }
      }

      // load this export query data into the form
      var loadExportQuery = function(archiveName) {
        var archiveConfig = $('#' + archiveName).find('input.config').val();

        var data = {};
        var key = "";
        var value = "";

        // parse the export query out of it
        var rx = /aExportQuery=(.*)\n/;

        var aExportQuery = rx.exec(archiveConfig);

        // is there a first match
        if (aExportQuery != null && aExportQuery[1]) {
          // console.log(aExportQuery[1]);

          var params = aExportQuery[1].split("\t");

          // console.log(params);

          // parse parameters
          for ( var i = 0; i < params.length; i++) {
            // is this a valid parameter?
            if (params[i].indexOf(" ") >= 0) {
              key = params[i].substring(0, params[i].indexOf(" "));
              value = params[i].substring(params[i].indexOf(" ") + 1);
              data[key] = value;
            }
          }

          // store in DOM
          $('#' + archiveName).data('export-query', data);

          // load into query dialog
          loadQueryDialog(data);

          return true;
        }

        // no data found
        return false;
      }

      /**
       * loads an archive job's data into the query editor dialog
       */
      var loadQueryDialog = function(data) {
        if (data.AllRevisions == '1') {
          $('#AllRevisions').attr('checked', 'checked');
        } else {
          $('#AllRevisions').removeAttr('checked');
        }

        if (data.LatestRevisions == '1') {
          $('#LatestRevisions').attr('checked', 'checked');
        } else {
          $('#LatestRevisions').removeAttr('checked');
        }

        if (data.NotLatestRevisions == '1') {
          $('#NotLatestRevisions').attr('checked', 'checked');
        } else {
          $('#NotLatestRevisions').removeAttr('checked');
        }

        if (data.MostRecentMatching == '1') {
          $('#MostRecentMatching').attr('checked', 'checked');
        } else {
          $('#MostRecentMatching').removeAttr('checked');
        }

        /*
         * not used at the moment if (data.IsCustom == '1') {
         * $('#IsCustom').attr('checked', 'checked'); } else {
         * $('#IsCustom').removeAttr('checked'); }
         */

        if (data.UseExportDate == '1') {
          $('#UseExportDate').attr('checked', 'checked');
        } else {
          $('#UseExportDate').removeAttr('checked');
        }

        if (data.AllowExportPublished == '1') {
          $('#AllowExportPublished').attr('checked', 'checked');
        } else {
          $('#AllowExportPublished').removeAttr('checked');
        }

        $('#CustomQuery').val(unescapeExportQuery(data.CustomQuery));

        $('#edit-query-form-valid').val('1'); // form is now valid
      }

      // upload ajax dialog
      $(".actions a.upload-action").each(
          function(index, elem) {
            var archiveName = $(elem).closest('div').attr('id');

            var uploader = new AjaxUpload($(this), {
              action : httpCgiPath,
              name : 'primaryFile',
              data : {
                IdcService : 'SPEEDY_ARCHIVER_UPLOAD',
                IsSoap : 1,
                archiveName : archiveName,
                file : 'zipArchive'
              },
              onSubmit : function(file, ext) {
                $('#form-import-archive').find('input[name=aArchiveName]').val(archiveName);
              },
              onChange : function(file, ext) {
                $('#dialog-upload-info .message').text('Please wait while your file uploads');
                $('#dialog-upload-info .loading').show();

                // disable buttons
                $("#dialog-upload-info").dialog('widget').find("button").attr('disabled', 'disabled').addClass(
                    'ui-state-disabled');
                $('#dialog-upload-info').dialog('open');

                if (ext != "zip") {
                  $('#dialog-upload-info .message').text(
                      'You can upload only Zip files (make sure they are downloaded using SpeedyArchiver)!');
                  $('#dialog-upload-info .loading').hide();
                  return false;
                }
              },
              onComplete : function(file, response) {
                $('#dialog-upload-info .loading').hide();
                if ($(response).find('idc\\:field[name=uploadedArchive]').text() == 'true') {
                  $('#dialog-upload-info .message').text('Upload complete!');
                } else {
                  $('#dialog-upload-info .message').text('Error during upload!');
                }

                // enable all buttons
                $("#dialog-upload-info").dialog('widget').find("button").removeAttr("disabled").removeClass(
                    'ui-state-disabled');
                $("#dialog-upload-info").dialog('widget').find("button:contains(OK) .ui-button-text").text('Close');
              }
            });

            // initializing dialogs
            $("#dialog-upload-info").dialog({
              resizable : false,
              height : 200,
              width : 480,
              modal : true,
              autoOpen : false,
              show : 'fade',
              hide : 'fade',
              closeOnEscape : false,
              open : function() {
                $("#dialog-upload-info").dialog('widget').find("button:contains(Close) .ui-button-text").text('OK');
              },
              buttons : {
                "Import" : function() {
                  importArchive();
                  $(this).dialog('close');
                },
                "OK" : function() {
                  $(this).dialog('close');
                }
              }
            });

            $('#edit-query-dialog').dialog({
              modal : true,
              width : 685,
              autoOpen : false,
              show : 'fade',
              hide : 'fade',
              buttons : {
                "OK" : function() {
                  $('#edit-query-form').submit();
                  $('#edit-query-form-valid').val('0'); // reset valid flag
                  $(this).dialog('close');
                },
                "Cancel" : function() {
                  $('#edit-query-form-valid').val('0'); // reset valid flag
                  $(this).dialog('close');
                }
              }
            });

            $('#dialog-export').dialog({
              modal : true,
              width : 480,
              autoOpen : false,
              show : 'fade',
              hide : 'fade',
              open : function() {
                $("#dialog-export-options").show();
              },
              buttons : {
                "Export" : function() {
                  exportArchive();
                  // $(this).dialog('close');
                },
                "Cancel" : function() {
                  $(this).dialog('close');
                }
              }
            });

            $('#dialog-view-batches').dialog(
                {
                  modal : true,
                  width : 400,
                  height : 400,
                  autoOpen : false,
                  show : 'fade',
                  hide : 'fade',
                  buttons : {
                    "Import" : function() {
                      var batches = $('#dialog-view-batches-selected').data('selected');

                      var form = $('#form-import-batch');

                      for ( var i = 0; i < batches.length; i++) {
                        form.find('input[name=aBatchFile]').val(batches[i]);

                        $.ajax({
                          async : false,
                          type : 'POST',
                          url : form.attr('action'),
                          data : form.serialize(),
                          success : function(data, textStatus) {
                            if (data.LocalData.StatusCode && data.LocalData.StatusCode != '') {
                              $('#dialog-view-batches-status').append('<br />error importing batch: ' + batches[i]);
                              $('#dialog-view-batches-status').append(data.LocalData.StatusMessage);
                            } else {
                              $('#dialog-view-batches-status').append('<br />imported batch: ' + batches[i]);
                            }
                            $('#dialog-view-batches-status')
                                .scrollTop($('#dialog-view-batches-status')[0].scrollHeight);
                          },
                          error : function(data) {
                            alert('error');
                          },
                          dataType : 'json'
                        });
                      }
                    },
                    "Delete" : function() {
                      var batches = $('#dialog-view-batches-selected').data('selected');

                      var form = $('#form-delete-batch');

                      for ( var i = 0; i < batches.length; i++) {
                        form.find('input[name=aBatchFile]').val(batches[i]);

                        $.ajax({
                          async : false,
                          type : 'POST',
                          url : form.attr('action'),
                          data : form.serialize(),
                          success : function(data, textStatus) {
                            $('#dialog-view-batches-list tr').each(
                                function(i, ele) {
                                  if ($(ele).data('filepath') == data.LocalData.aBatchFile) {
                                    $(ele).remove();
                                    $('#dialog-view-batches-status').append('<br />deleted batch: ' + batches[i]);
                                    $('#dialog-view-batches-status').scrollTop(
                                        $('#dialog-view-batches-status')[0].scrollHeight);
                                  }
                                });
                          },
                          error : function(data) {
                            alert('error');
                          },
                          dataType : 'json'
                        });
                      }
                    }
                  }
                });

            $('#dialog-view-batches-list').selectable({
              filter : "tr",
              stop : function() {
                var result = [];
                $(".ui-selected", this).each(function() {
                  result.push($(this).data('filepath'));
                });

                $('#dialog-view-batches-selected').data('selected', result);
              }
            });

            $('#dialog-view-batches-list td').click(function() {
              $(this).closest('tr').toggleClass('ui-selected');
            });

          });

      var refreshArchives = function() {
        $.ucm.service("SPEEDY_GET_ARCHIVES", {}, function(data) {
          if (data.ResultSets.Archives) {

            var rows = data.ResultSets.Archives.rows;

            var dateFormatString = data.LocalData.blDateFormat;

            // field indices
            var NAME = 0, LAST_EXPORT = 1, LAST_IMPORT = 2, EXPORTED = 3, IMPORTED = 4;

            for ( var i = 0; i < rows.length; i++) {
              var archiveName = rows[i][NAME];

              $("#export-date-" + archiveName).text(rows[i][LAST_EXPORT]);
              $("#export-count-" + archiveName).text(rows[i][EXPORTED]);
              $("#import-date-" + archiveName).text(rows[i][LAST_IMPORT]);
              $("#import-count-" + archiveName).text(rows[i][IMPORTED]);
            }
          }
        },
        // error
        function() {
          if (refreshTimer !== -1) {
            clearInterval(refreshTimer);
            refreshTimer = -1;
          }
        });
      };

      var formatDate = function(fmt, str) {
        var d = parseIdcDate(str);

        // e.g: dd/MM/yyyy {H:mm[:ss] [zzz]}!tAustralia/Sydney
        var formatString = fmt.replace(/!t.*$/, "").replace(/[\{\[\}\]]/g, "").replace("zzz", "tt");

        return d.toString(formatString);
      };

      var parseIdcDate = function(str) {
        var dateStrip = /ts '(.*?)\..*'/;

        var matches = dateStrip.exec(str);

        return new Date(matches[1])
      };

      var stopRefreshTimer = function(rows) {
        clearInterval(refreshTimer);
        refreshTimer = -1;
        $("#btn-refresh-toggle").text("Start");
        $("#refresh-spinner").removeClass("spinner-active");
      };

      var startRefreshTimer = function() {
        refreshTimer = setInterval(refreshArchives, $("#refresh-time").val());
        $("#btn-refresh-toggle").text("Stop");
        $("#refresh-spinner").addClass("spinner-active");
      };

      if ($("#refresh-time").length > 0) {

        var refreshTimer = -1;

        startRefreshTimer();

        $("#refresh-time").change(function() {
          clearInterval(refreshTimer);
          startRefreshTimer();
        });

        $("#btn-refresh-toggle").click(function() {
          if (refreshTimer === -1) {
            startRefreshTimer();
          } else {
            stopRefreshTimer();
          }
        });
      }

    }); // document.ready()
