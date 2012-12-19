/**
 * @file
 *
 * Pagerer jquery scripts.
 *
 * @todo - document
 * pagererState
 * path: drupal *request* path inclusive of querystring fragment, no base path
 * element: integer to distinguish between multiple pagers on one page
 * quantity: number of page elements in the pager list
 * total: total number of pages in the query
 * totalItems: total number of items in the query
 * current: 0-base index of current page
 * interval: number of elements per page (1 if display = pages, items per page if display = items/item_ranges
 * display: pages|items|item_ranges indicates what is displayed in the page element
 * action:
 * timelapse:
 * icons:
 * tickmarkTitle:
 * pageTitle:
 * firstTitle:
 * lastTitle:
 * rangeSeparator:
 *
 * @todo
 * Scrollpane -
 * - acceleration of shift
 * - goto first/last if not enough elements
 * - items_ranges anchor width
 * - left margin in pagererstate useless?
 * - queue only click to same button
 * - anchors in views ajax
 * Slider -
 * - slider handle width with item ranges
 * - move spinInterval to settings
 */
(function ($) {

Drupal.settings.pagerer = {
  timeoutAction: 0,
  intervalAction: 0,
  intervalCount: 0,
  isRelocating: false,
}

Drupal.behaviors.pagerer = {

  attach: function(context, settings) {

    /**
     * Constants.
     */
    var PAGERER_LEFT = -1;
    var PAGERER_RIGHT = 1;

    /**
     * 'pagerer-page' input box event binding
     */
    $('.pagerer-page', context)
    .ready().each(function(index) {
      Drupal.settings.pagerer.isRelocating = false;
      this.pagererState = eval('(' + $(this).attr('name') + ');');
      // Item ranges do not really work on widget.
      if (this.pagererState.display == 'item_ranges') {
        this.pagererState.display = 'items';
      }
      // Adjust width of the input box.
      if (this.pagererState.widgetResize) {
        $(this).width(String(indexToValue(this.pagererState.total - 1, this.pagererState)).length + 'em');
      }
    })
    .bind('focus', function(event) {
      clearDelayedAction();
      this.select();
      $(this).addClass('pagerer-page-has-focus');
    })
    .bind('blur', function(event) {
      $(this).removeClass('pagerer-page-has-focus');
    })
    .bind('keydown', function(event) {
      switch(event.keyCode) {
        case 13:
        case 10:
          // Return key pressed, relocate.
          var targetPage = valueToIndex($(this).val(), this.pagererState);
          if (targetPage != this.pagererState.current) {
            pagererRelocate(this, this, targetPage);
          }
          event.stopPropagation();
          event.preventDefault();
          return false;
        case 27:
          // Escape.
          $(this).val(indexToValue(this.pagererState.current, this.pagererState));
          return false;
        case 38:
          // Up.
          widgetOffsetValue(this, -1);
          return false;
        case 40:
          // Down.
          widgetOffsetValue(this, 1);
          return false;
        case 33:
          // Page up.
          widgetOffsetValue(this, -5);
          return false;
        case 34:
          // Page down.
          widgetOffsetValue(this, 5);
          return false;
        case 35:
          // End.
           $(this).val(indexToValue(this.pagererState.total - 1, this.pagererState));
          return false;
        case 36:
          // Home.
           $(this).val(1);
          return false;
      }
    });

    /**
     * 'pagerer-slider' jQuery UI slider event binding.
     */
    $('.pagerer-slider', context)
    .ready().each(function(index) {
      Drupal.settings.pagerer.isRelocating = false;
      this.pagererState = eval('(' + $(this).attr('id') + ');');

      // Create slider.
      var sliderBar = $(this);
      sliderBar.slider({
        min: 0,
        max: this.pagererState.total - 1,
        step: 1,
        value: this.pagererState.current,
        range: 'min',
        animate: true,
      });

      // Adjust slider handle dimensions and text.
      var sliderHandle = sliderBar.find('.ui-slider-handle');
      sliderHandle
        .css('width', (String(indexToValue(this.pagererState.total - 1, this.pagererState)).length + 2) + 'em')
        .css('height', Math.max(sliderHandle.height(), 16) + 'px')
        .css('line-height', Math.max(sliderHandle.height(), 16) + 'px')
        .css('margin-left', -sliderHandle.width() / 2)
        .text(indexToValue(this.pagererState.current, this.pagererState))
        .bind('blur', function(event) {
          clearDelayedAction();
          var sliderBar = $(this).parent().get(0);
          if (!sliderBar.pagererState.spinning) {
            sliderBar.pagererState.spinning = true;
            $(sliderBar).slider('option', 'value', sliderBar.pagererState.current);
            $(this).text(indexToValue(sliderBar.pagererState.current, sliderBar.pagererState));
            sliderBar.pagererState.spinning = false;
          }
        });

      // Set slider bar dimensions.
      sliderBar
        .width((this.pagererState.quantity * 3) + 'em')
        .css('margin-left', sliderHandle.width() / 2)
        .css('margin-right', sliderHandle.width() / 2);

      var pixelsPerStep = sliderBar.width() / this.pagererState.total;
      // If autodetection of navigation action, determine whether to
      // use tickmark or timelapse.
      if (this.pagererState.action == 'auto') {
        if (pixelsPerStep > 3) {
          this.pagererState.action = 'timelapse';
        } else {
          this.pagererState.action = 'tickmark';
        }
      }
      // If autodetection of navigation icons, determine whether to
      // hide icons.
      if (this.pagererState.icons == 'auto' && pixelsPerStep > 3) {
        $(this).parents('.pager').find('.pagerer-slider-control-icon').parent().hide();
      }
      // Add information to user to click on the tickmark to start page
      // relocation.
      if (this.pagererState.action == 'tickmark') {
        var title = $(this).attr('title');
        $(this).attr('title',  title + ' ' + this.pagererState.tickmarkTitle);
      }
    })
    .bind('slide', function(event, ui) {
      clearDelayedAction();
      $(this).find('.ui-slider-handle').text(indexToValue(ui.value, this.pagererState));
    })
    .bind('slidechange', function(event, ui) {

      var sliderHandle = $(this).find('.ui-slider-handle');
      sliderHandle.text(indexToValue(ui.value, this.pagererState));

      // If currently sliding the handle via navigation icons,
      // do nothing.
      if (this.pagererState.spinning) {
        return false;
      }

      // Determine target page.
      var targetPage = $(this).slider('option', 'value');

      // Relocate immediately to target page if no
      // tickmark/timelapse confirmation required.
      if (this.pagererState.action == 'timelapse' && this.pagererState.timelapse == 0) {
        sliderHandle.append("<div class='pagerer-slider-handle-icon'/>");
        var sliderHandleIcon = sliderHandle.find('.pagerer-slider-handle-icon');
        pagererRelocate(this, sliderHandleIcon, targetPage);
        return false;
      }

      // Otherwise, add a tickmark or clock icon to the handle text,
      // to be clicked to activate page relocation.
      sliderHandle.text(indexToValue(ui.value, this.pagererState) + ' ');
      if (this.pagererState.action == 'timelapse') {
        sliderHandle.append("<div class='pagerer-slider-handle-icon throbber'/>");
      } else {
        sliderHandle.append("<div class='pagerer-slider-handle-icon ui-icon ui-icon-check'/>");
      }

      // Bind page relocation to mouse clicking on the icon.
      var sliderBar = this;
      var sliderHandleIcon = sliderHandle.find('.pagerer-slider-handle-icon');
      sliderHandleIcon.bind('mousedown', function(event) {
        clearDelayedAction();
        // Remove icon.
        $(sliderBar).find('.pagerer-slider-handle-icon').removeClass('throbber');
        // Relocate.
        pagererRelocate(sliderBar, sliderHandleIcon, targetPage);
        return false;
      });

      // Bind page relocation to timeout of timelapse.
      if (this.pagererState.action == 'timelapse') {
        setDelayedAction(function() {
          // Remove icon.
          $(sliderBar).find('.pagerer-slider-handle-icon').removeClass('ui-icon').removeClass('throbber');
          // Relocate.
          pagererRelocate(sliderBar, sliderHandleIcon, targetPage);
          return false;
        }, this.pagererState.timelapse);
      }

    });

    /**
      * pagerer-slider control icons event binding
      *
      * The navigation icons serve as an helper for the slider positioning,
      * to fine-tune the selection. Once mouse is pressed on an icon, the
      * slider handle is moved +/- one value. If mouse is kept pressed, the
      * slider handle will move continuosly. When mouse is released or moved
      * away from the icon, sliding will stop and the handle status will be
      * processed through slider 'slidechange' event triggered by the
      * sliderOffsetValue() function.
      */
    var spinInterval = 0;
    var spinIdleCycles = 0;
    // Spin events.
    $('.pagerer-slider-control-icon', context)
    .bind('mousedown', function(event) {
      clearDelayedAction();
      var slider = $(this).parents('.pager').find('.pagerer-slider').get(0);
      slider.pagererState.spinning = true;
      var offset = $(this).hasClass('ui-icon-circle-minus') ? PAGERER_LEFT : PAGERER_RIGHT;
      sliderOffsetValue(slider, offset);
      spinInterval = setInterval(function(){
        spinIdleCycles++;
        if (spinIdleCycles > 10) {
          sliderOffsetValue(slider, offset);
        }
      }, 50);
    })
    .bind('mouseup mouseleave', function() {
      var slider = $(this).parents('.pager').find('.pagerer-slider').get(0);
      if (slider.pagererState.spinning) {
        spinIdleCycles = 0;
        clearInterval(spinInterval);
        slider.pagererState.spinning = false;
        sliderOffsetValue(slider, 0);
        $(slider).find('.ui-slider-handle').focus();
      }
    });

    /**
     * 'pagerer-scrollpane' event binding.
     */
    $('.pagerer-scrollpane', context)
    .ready().each(function(index) {
      Drupal.settings.pagerer.isRelocating = false;

      // Get the scrollpane components, i.e. the viewport, the
      // pager wrapped within it, and the wrapped pager elements.
      var viewport = $(this).find('.item-list');
      var pager = $(this).find('.pager').get(0);
      var pagerElements = $(this).find('li');

      // Attach state variables to the wrapped pager.
      pager.pagererState = eval('(' + $(this).attr('id') + ');');
      $.extend(pager.pagererState, {
        scrollpane: $(this),
        viewport: viewport,
        pagerElementWidth: 0,
        pagerElementLeftMargin: 0,
        pagerElementsLeftOverflow: 0,
        pagerElementsRightOverflow: 0,
      });

      // Determine pager element width from maximum width possible.
      var dupe = $(pagerElements[0]).clone();
      dupe.removeClass('pager-current first last');
      dupe.addClass('pager-item pagerer-dupe');
      dupe.text(indexToValue(pager.pagererState.total - 1, pager.pagererState));
      $(pager).append(dupe);
      pager.pagererState.pagerElementWidth = Math.ceil($(dupe).outerWidth(true));
      pager.pagererState.pagerElementLeftMargin = parseInt($(dupe).css('margin-left'))
      var cellHeight = Math.ceil($(dupe).outerHeight(true));
      $(pager).find('.pagerer-dupe').remove();

      // Set dimensions.
      var pagerWidth = pagerElements.length * pager.pagererState.pagerElementWidth;
      var viewportWidth = Math.min(pager.pagererState.quantity * pager.pagererState.pagerElementWidth, pagerWidth);
      $(this).css({
        width: viewportWidth + 'px',
        height: cellHeight + 'px',
      });
      $(viewport).css({
        width: viewportWidth + 'px',
        height: cellHeight + 'px',
      });
      $(pager).css({
        width: pagerWidth + 'px',
        height: cellHeight + 'px',
      });

      // Allocate input pager elements to pager.
      var elementLeft = 0;
      var pagerCurrentElement = 0;
      pagerElements.each(function(index) {
        var elementWidth = $(this).outerWidth(true);
        var elementLeftMargin = pager.pagererState.pagerElementLeftMargin + ((pager.pagererState.pagerElementWidth - elementWidth) / 2);
        $(this).css('left', elementLeft + 'px');
        $(this).css('margin-left', elementLeftMargin + 'px');
        if ($(this).hasClass('pager-current')) {
          pagerCurrentElement = index;
        }
        elementLeft += pager.pagererState.pagerElementWidth;
      });

      // Set current item in the middle of the viewport.
      var pagerLeftElement = pagerCurrentElement - Math.floor(pager.pagererState.quantity / 2);
      if (pagerLeftElement < 0) {
        pagerLeftElement = 0;
      } else if (pagerLeftElement > pagerElements.length - pager.pagererState.quantity) {
        pagerLeftElement = pagerElements.length - pager.pagererState.quantity;
      }
      var pagerLeftOffset = $(pagerElements[pagerLeftElement]).css('left');
      $(pager).css('left', '-' + pagerLeftOffset);

      // Add elements to the left.
      pager.pagererState.pagerElementsLeftOverflow = scrollpaneAddPagerElements(
        pager,
        PAGERER_LEFT,
        valueToIndex($(pagerElements[0]).text(), pager.pagererState) - 1,
        pager.pagererState.quantity,
        true
      );

      // Add elements to the right.
      pagerElements = $(this).find('li');
      pager.pagererState.pagerElementsRightOverflow = scrollpaneAddPagerElements(
        pager,
        PAGERER_RIGHT,
        valueToIndex($(pagerElements[pagerElements.length - 1]).text(), pager.pagererState) + 1,
        pager.pagererState.quantity,
        true
      );

    });

    /**
     * todo
     */
    $('.pagerer-scrollpane-button', context)
    .ready().each(function(index) {
      this.pagererState = {
        scrollpane: $(this).parents('.pager').get(0),
        pager: $(this).parents('.pager').find('.pagerer-scrollpane').find('.item-list').find('.pager').get(0),
      };
      $(this).button();
      $(this)
      .bind('mousedown', function(event) {
        var button = this;
        clearDelayedAction();
        pagererQueueTransition(button.pagererState.pager, function(){scrollpaneButtonProcess(button, 500);}, 510);
        if ($(button).hasClass('pagerer-previous') || $(button).hasClass('pagerer-next')) {
          Drupal.settings.pagerer.intervalAction = setInterval(function(){
            Drupal.settings.pagerer.intervalCount++;
            if (Drupal.settings.pagerer.intervalCount > 20) {
              pagererQueueTransition(button.pagererState.pager, function(){scrollpaneButtonProcess(button, 20);}, 30);
            }
          }, 25);
        }
        event.stopPropagation();
        event.preventDefault();
      })
      .bind('mouseup mouseleave', function(event) {
        Drupal.settings.pagerer.intervalCount = 0;
        clearInterval(Drupal.settings.pagerer.intervalAction);
      })
    })
    .load().each(function(index) {
      // Aligns viewport border color to button style.
      if ($(this).hasClass('pagerer-first')) {
        this.pagererState.pager.pagererState.viewport.css({
          'border-color' : $(this).css('border-color'),
        });
      }
      // Set button enable/disabled state.
      scrollpaneSetButtonState(this);
    });

    /**
     * Todo.
     */
    function scrollpaneButtonProcess(button, duration) {
      var pager = button.pagererState.pager;
      var pagerElements = $(pager).find('li');
      if ($(button).hasClass('pagerer-next')) {
        // ***** Next - shift left.
        var last = valueToIndex($(pagerElements[pagerElements.length - 1]).text(), pager.pagererState);
        if (pager.pagererState.pagerElementsLeftOverflow < pager.pagererState.quantity) {
          // There's space on the left side to shift pager.
          if (scrollpaneAddPagerElements(pager, PAGERER_RIGHT, last + 1, 1, true)) {
            // An element was added to the right, so shift pager to the left.
            scrollpaneShiftPager(pager, PAGERER_LEFT, 1, duration, 1, -1);
          } else {
            // No further elements on the right, end of run.
            return false;
          }
        } else {
          // No space on the left side to shift pager.
          if (scrollpaneAddPagerElements(pager, PAGERER_RIGHT, last + 1, 1, false)) {
            // An element was added to the right, so shift elements to the left.
            scrollpaneRemovePagerElements(pager, PAGERER_LEFT, 1, false);
            scrollpaneShiftPagerElements(pager, PAGERER_LEFT, 1, duration, 1, -1);
          } else {
            // End of run to the right. If pager allows, shift it.
            if (pager.pagererState.pagerElementsRightOverflow > 0) {
              scrollpaneRemovePagerElements(pager, PAGERER_LEFT, 1, true);
              scrollpaneShiftPager(pager, PAGERER_LEFT, 1, duration, 1, -1);
            } else {
              // End of run, can't move.
              return false;
            }
          }
        }
        $(button.pagererState.scrollpane).find('.ui-button').each(function() {
          scrollpaneSetButtonState(this);
        });
      } else if ($(button).hasClass('pagerer-previous')) {
        // ***** Previous - shift right.
        var first = valueToIndex($(pagerElements[0]).text(), pager.pagererState);
        if (pager.pagererState.pagerElementsRightOverflow < pager.pagererState.quantity) {
          // There's space on the right side to shift pager.
          if (scrollpaneAddPagerElements(pager, PAGERER_LEFT, first - 1, 1, true)) {
            // An element was added to the left, so shift pager to the right.
            scrollpaneShiftPager(pager, PAGERER_RIGHT, 1, duration, -1, 1);
          } else {
            // No further elements on the left, end of run.
            return false;
          }
        } else {
          // No space on the right side to shift pager.
          if (scrollpaneAddPagerElements(pager, PAGERER_LEFT, first - 1, 1, false)) {
            // An element was added to the left, so shift elements to the right.
            scrollpaneRemovePagerElements(pager, PAGERER_RIGHT, 1, false);
            scrollpaneShiftPagerElements(pager, PAGERER_RIGHT, 1, duration, -1, 1);
          } else {
            // End of run to the left. If pager allows, shift it.
            if (pager.pagererState.pagerElementsLeftOverflow > 0) {
              scrollpaneRemovePagerElements(pager, PAGERER_RIGHT, 1, true);
              scrollpaneShiftPager(pager, PAGERER_RIGHT, 1, duration, -1, 1);
            } else {
              // End of run, can't move.
              return false;
            }
          }
        }
        $(button.pagererState.scrollpane).find('.ui-button').each(function() {
          scrollpaneSetButtonState(this);
        });
      } else if ($(button).hasClass('pagerer-first')) {
        var first = valueToIndex($(pagerElements[0]).text(), pager.pagererState);
        var fromEl = Math.min((pager.pagererState.quantity * 2), first);
        var count = fromEl + 1;
        scrollpaneAddPagerElements(pager, PAGERER_LEFT, fromEl, count, true);
        scrollpaneShiftPager(pager, PAGERER_RIGHT, pager.pagererState.pagerElementsLeftOverflow, duration, -pager.pagererState.pagerElementsLeftOverflow, pager.pagererState.pagerElementsLeftOverflow);
        setTimeout(function() {
//console.log(pager.pagererState.pagerElementsLeftOverflow - pager.pagererState.quantity);
          scrollpaneRemovePagerElements(pager, PAGERER_RIGHT, pager.pagererState.pagerElementsRightOverflow - pager.pagererState.quantity, true);
          $(button.pagererState.scrollpane).find('.ui-button').each(function() {
            scrollpaneSetButtonState(this);
          });
        }, duration + 5);
      } else if ($(button).hasClass('pagerer-last')) {
        // ***** Last.
        var last = valueToIndex($(pagerElements[pagerElements.length - 1]).text(), pager.pagererState);
        var fromEl = Math.max((pager.pagererState.total - (pager.pagererState.quantity * 2) + 1), last);
        var count = pager.pagererState.total - fromEl + 1;
        scrollpaneAddPagerElements(pager, PAGERER_RIGHT, fromEl, count, true);
        pagerElements = $(pager).find('li');
        scrollpaneShiftPager(pager, PAGERER_LEFT, pagerElements.length - pager.pagererState.pagerElementsLeftOverflow - pager.pagererState.quantity, duration, pager.pagererState.pagerElementsRightOverflow, -pager.pagererState.pagerElementsRightOverflow);
        setTimeout(function() {
//console.log(pager.pagererState.pagerElementsLeftOverflow - pager.pagererState.quantity);
          scrollpaneRemovePagerElements(pager, PAGERER_LEFT, pager.pagererState.pagerElementsLeftOverflow - pager.pagererState.quantity, true);
          $(button.pagererState.scrollpane).find('.ui-button').each(function() {
            scrollpaneSetButtonState(this);
          });
        }, duration + 5);
      }
    }

    /**
     * Todo.
     */
    function scrollpaneAddPagerElements(pager, side, start, count, pagerResize) {
console.log('add start: ' + pager.pagererState.pagerElementsLeftOverflow + ' ' + pager.pagererState.pagerElementsRightOverflow);
console.log('side: ' + side + ' count: ' + count + ' start: ' + start);
      for (var i = 0; i < count; i++) {
        var pagerElements = $(pager).find('li');
        if (side == PAGERER_RIGHT) {
          var last = pagerElements.length - 1;
          if (valueToIndex($(pagerElements[last]).text(), pager.pagererState) == (pager.pagererState.total - 1)) {
            break;
          }
          var dupe = $(pagerElements[last]).clone();
          $(pagerElements[last]).removeClass('last');
          $(dupe).css('left', (parseInt($(dupe).css('left')) + pager.pagererState.pagerElementWidth) + 'px');
          scrollpaneSetPagerElementHTML(dupe, pager, start + i);
          $(pager).append(dupe);
          var elementWidth = $(dupe).outerWidth(true);
          var elementLeftMargin = pager.pagererState.pagerElementLeftMargin + ((pager.pagererState.pagerElementWidth - elementWidth) / 2);
          $(dupe).css('margin-left', elementLeftMargin + 'px');
          pager.pagererState.pagerElementsRightOverflow++;
        } else if (side == PAGERER_LEFT) {
          var first = 0;
          if (valueToIndex($(pagerElements[first]).text(), pager.pagererState) == 0) {
            break;
          }
          var dupe = $(pagerElements[first]).clone();
          $(pagerElements[first]).removeClass('first');
          $(dupe).css('left', (parseInt($(dupe).css('left')) - pager.pagererState.pagerElementWidth) + 'px');
          scrollpaneSetPagerElementHTML(dupe, pager, start - i);
          $(pager).prepend(dupe);
          var elementWidth = $(dupe).outerWidth(true);
          var elementLeftMargin = pager.pagererState.pagerElementLeftMargin + ((pager.pagererState.pagerElementWidth - elementWidth) / 2);
          $(dupe).css('margin-left', elementLeftMargin + 'px');
          pager.pagererState.pagerElementsLeftOverflow++;
        }
      }
console.log('add (' + i + '): ' + pager.pagererState.pagerElementsLeftOverflow + ' ' + pager.pagererState.pagerElementsRightOverflow);
      if (pagerResize) {
        pagerElements = $(pager).find('li');
        $(pager).css('width', ((pagerElements.length) * pager.pagererState.pagerElementWidth) + 'px');
        if (side == PAGERER_LEFT) {
          $(pager).css({
            left: (parseInt($(pager).css('left')) - (pager.pagererState.pagerElementWidth * i)) + 'px',
            '-webkit-transition-property': 'none',
          });
          scrollpaneShiftPagerElements(pager, PAGERER_RIGHT, i, 0, 0, 0);
        }
      }
      return i;
    }

    /**
     * Todo.
     */
    function scrollpaneRemovePagerElements(pager, side, count, pagerResize) {
//alert('remove start: ' + pager.pagererState.pagerElementsLeftOverflow + ' ' + pager.pagererState.pagerElementsRightOverflow);
      for (var i = 0; i < count; i++) {
        var pagerElements = $(pager).find('li');
        if (side == PAGERER_RIGHT) {
          $(pagerElements[pagerElements.length - 1]).remove();
          $(pagerElements[pagerElements.length - 1]).addClass('first');
          pager.pagererState.pagerElementsRightOverflow--;
        } else if (side == PAGERER_LEFT) {
          $(pagerElements[0]).remove();
          $(pagerElements[0]).addClass('first');
          pager.pagererState.pagerElementsLeftOverflow--;
        }
      }
//alert('remove (' + i + '); ' + pager.pagererState.pagerElementsLeftOverflow + ' ' + pager.pagererState.pagerElementsRightOverflow);
      if (pagerResize) {
        $(pager).css('width', ((pagerElements.length - 1) * pager.pagererState.pagerElementWidth) + 'px');
        if (side == PAGERER_LEFT) {
          $(pager).css({
            left: (parseInt($(pager).css('left')) + (pager.pagererState.pagerElementWidth * count)) + 'px',
            '-webkit-transition-property': 'none',
          });
          scrollpaneShiftPagerElements(pager, PAGERER_LEFT, i, 0, 0, 0);
        }
      }
      return true;
    }

    /**
     * Todo.
     */
    function scrollpaneShiftPagerElements(pager, direction, count, duration, xxxload, xxxroad) {
      var pagerElements = $(pager).find('li');
      pagerElements.each(function(index) {
        $(this).css({
          left: (parseInt($(this).css('left')) + (direction * pager.pagererState.pagerElementWidth * count)) + 'px',
          '-webkit-transition-property': 'left',
          '-webkit-transition-duration': duration + 'ms'
        });
      });
      pager.pagererState.pagerElementsLeftOverflow += xxxload;
      pager.pagererState.pagerElementsRightOverflow += xxxroad;
    }

    /**
     * Todo.
     */
    function scrollpaneShiftPager(pager, direction, count, duration, xxxload, xxxroad) {
      var left = parseInt($(pager).css('left'));
      var offset = direction * count * pager.pagererState.pagerElementWidth;
      $(pager).css({
        left: (left + offset) + 'px',
        '-webkit-transition-property': 'left',
        '-webkit-transition-duration': duration + 'ms',
      });
      pager.pagererState.pagerElementsLeftOverflow += xxxload;
      pager.pagererState.pagerElementsRightOverflow += xxxroad;
    };

    /**
     * Todo.
     */
    function scrollpaneSetPagerElementHTML(element, pager, targetPage) {
      if (targetPage == pager.pagererState.current) {
        $(element[0]).removeClass('pager-item').addClass('pager-current');
        $(element[0]).text(indexToValue(targetPage, pager.pagererState));
      } else {
        $(element[0]).removeClass('pager-current').addClass('pager-item');
        var anchor = $(element).find('a');
        if (!anchor.length) {
          $(element).text('');
          $(element).append('<a></a>');
          anchor = $(element).find('a');
        }
        anchor[0].href = Drupal.settings.basePath + pager.pagererState.path.replace(/pagererpage/, targetPage);
        anchor[0].title = Drupal.t('Go to page @number', { '@number': targetPage + 1});
        $(anchor[0]).text(indexToValue(targetPage, pager.pagererState));
      }
    }

    /**
     * Todo.
     */
    function scrollpaneSetButtonState(elem) {
      if ($(elem).hasClass('pagerer-first') || $(elem).hasClass('pagerer-previous')) {
        if (elem.pagererState.pager.pagererState.pagerElementsLeftOverflow == 0) {
          $(elem).mouseup().mouseleave();
          $(elem).button('disable');
        } else {
          $(elem).button('enable');
        }
      }
      if ($(elem).hasClass('pagerer-next') || $(elem).hasClass('pagerer-last')) {
        if (elem.pagererState.pager.pagererState.pagerElementsRightOverflow == 0) {
          $(elem).mouseup().mouseleave();
          $(elem).button('disable');
        } else {
          $(elem).button('enable');
        }
      }
    }


    /**
     * Helper functions
     */

    /**
     * Todo.
     */
    function indexToValue(index, state) {
      switch(state.display) {
        case 'pages':
          return index + 1;
          break;

        case 'items':
          return (index * state.interval) + 1;
          break;

        case 'item_ranges':
          return Drupal.t('@min@separator@max', {
            '@min': (index * state.interval) + 1,
            '@separator': state.rangeSeparator,
            '@max': Math.min(((index + 1) * state.interval), state.totalItems),
          });
          break;

      }
    }

    /**
     * Todo.
     */
    function valueToIndex(value, state) {
      switch(state.display) {
        case 'pages':
          if (isNaN(value)) {
            return 0;
          }
          value = parseInt(value);
          if (value < 1) {
            return 0;
          }
          if (value > state.total) {
            value = state.total;
          }
          return value - 1;
          break;

        case 'items':
          if (isNaN(value)) {
            return 0;
          }
          value = parseInt(value);
          if (value < 1) {
            return 0;
          }
          if (value > state.totalItems) {
            value = state.totalItems;
          }
          return parseInt((value - 1) / state.interval);
          break;

        case 'item_ranges':
          var values = value.split(state.rangeSeparator);
          value = values[0];
          if (isNaN(value)) {
            return 0;
          }
          value = parseInt(value);
          if (value < 1) {
            return 0;
          }
          if (value > state.totalItems) {
            value = state.totalItems;
          }
          return parseInt((value - 1) / state.interval);
          break;

      }
    }

    /**
     * Todo.
     */
    function pagererQueueTransition(element, action, delay) {
        $(element).queue(function(next) {
          action();
          next();
        });
        $(element).delay(delay);
    }

    /**
     * Todo.
     */
    function setDelayedAction(action, delay) {
      clearDelayedAction();
      Drupal.settings.pagerer.timeoutAction = setTimeout(action, delay);
    }

    /**
     * Todo.
     */
    function clearDelayedAction() {
      if (Drupal.settings.pagerer.timeoutAction) {
        clearTimeout(Drupal.settings.pagerer.timeoutAction);
      }
    }

    /**
     * Relocate client browser to target page.
     *
     * Relocation method is decided based on the context of the pager element,
     * being in order of priority:
     *  - a AJAX enabled Views context - AJAX is used
     *  - a Views preview area in a Views settings form - AJAX is used
     *  - a page rendered through the admin overlay - BBQ is used
     *  - a normal page - document.location is used
     */
    function pagererRelocate(element, ajaxAttachElement, targetPage) {
      // Check we are not relocating already.
      if (Drupal.settings.pagerer.isRelocating) {
        return false;
      }
      Drupal.settings.pagerer.isRelocating = true;

      // Replace placeholder with page target.
      var path = element.pagererState.path.replace(/pagererpage/, targetPage);

      // Check if element is in Views AJAX context.
      var viewsAjaxContext = getViewsAjaxContext(element);
      if (viewsAjaxContext) {
        // Element is in Views AJAX context.
        attachViewsAjax(ajaxAttachElement, 'doViewsAjax', viewsAjaxContext, path);
        $(ajaxAttachElement).trigger('doViewsAjax');

      } else if ($(element).parents('#views-live-preview').length) {
        // Element is in Views preview context.
        var base = $(element).attr('id');
        var element_settings = {
          'event': 'doViewsAjax',
          'progress': { 'type': 'throbber' },
          'url': Drupal.settings.basePath + path,
          'method': 'html',
          'wrapper': 'views-live-preview',
        };
        Drupal.ajax[base] = new Drupal.ajax(base, element, element_settings);
        $(element).trigger('doViewsAjax');

      } else if (window.Drupal.overlayChild) {
        // Drupal admin overlay
        window.parent.jQuery.bbq.pushState({'overlay': path});

      } else {
        // Normal page
        document.location = Drupal.settings.basePath + path;

      }
    };

    /**
     * Update widget value.
     */
    function widgetOffsetValue(element, offset) {
      var widgetValue = valueToIndex($(element).val(), element.pagererState);
      var newValue = widgetValue + offset;
      if (newValue < 0) {
        newValue = 0;
      } else if (newValue >= element.pagererState.total) {
        newValue = element.pagererState.total - 1;
      }
      $(element).val(indexToValue(newValue, element.pagererState));
    };

    /**
     * Update slider value.
     */
    function sliderOffsetValue(element, offset) {
      var newValue = $(element).slider('option', 'value') + offset;
      var maxValue = $(element).slider('option', 'max');
      if (newValue >= 0 && newValue <= maxValue) {
        $(element).slider('option', 'value', newValue);
      }
    }

    /**
     * Views - Check if element is part of an AJAX enabled view.
     */
    function getViewsAjaxContext(element) {
      if (Drupal.settings && Drupal.settings.views && Drupal.settings.views.ajaxViews) {
        // Loop through active Views Ajax elements.
        for (var i in Drupal.settings.views.ajaxViews) {
          var view = '.view-dom-id-' + Drupal.settings.views.ajaxViews[i].view_dom_id;
          var viewDiv = $(element).parents(view);
          if (viewDiv.size()) {
            return {
              target: viewDiv.get(0),
              settings: Drupal.settings.views.ajaxViews[i],
              selector: view
            };
          }
        }
      }
      return false;
    }

    /**
     * Views - Attach Views AJAX behaviour to an element.
     */
    function attachViewsAjax(element, event, viewContext, path) {

      // Link to the element.
      var $link = $(element);

      // Retrieve the path to use for views' ajax.
      var ajax_path = Drupal.settings.views.ajax_path;

      // If there are multiple views this might've ended up showing up multiple times.
      if (ajax_path.constructor.toString().indexOf('Array') != -1) {
        ajax_path = ajax_path[0];
      }

      // Check if there are any GET parameters to send to views.
      var queryString = window.location.search || '';
      if (queryString !== '') {
        // Remove the question mark and Drupal path component if any.
        var queryString = queryString.slice(1).replace(/q=[^&]+&?|&?render=[^&]+/, '');
        if (queryString !== '') {
          // If there is a '?' in ajax_path, clean url are on and & should be used to add parameters.
          queryString = ((/\?/.test(ajax_path)) ? '&' : '?') + queryString;
        }
      }

      // Load view's settings and parse pagerer path.
      var viewData = {};
      $.extend(
        viewData,
        viewContext.settings,
        Drupal.Views.parseQueryString(Drupal.settings.basePath + path),
        Drupal.Views.parseViewArgs(Drupal.settings.basePath + path, viewContext.settings.view_base_path)
      );

      // Load AJAX element_settings object and attach AJAX behaviour.
      var elementAjaxSettings = {
        url: ajax_path + queryString,
        submit: viewData,
        setClick: true,
        event: event,
        selector: viewContext.selector,
        progress: { type: 'throbber' }
      };
      viewContext.pagerAjax = new Drupal.ajax(false, $link, elementAjaxSettings);
    }

  }
};
})(jQuery);
