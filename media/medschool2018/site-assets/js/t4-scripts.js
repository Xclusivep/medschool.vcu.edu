/**
 * Client: VCU School of Medicine
 * Project: VCU School of Medicine Site Redesign 2017-2018
 * Version: 0.1.0
 * Description: VCU School of Medicine Site Redesign, Information Architecture, Content Modellling and Build
 * Custom scripts and js libraries
 * Created by Michael Mason
 * on behalf of TERMINALFOUR
 * www.terminalfour.com
 */
 // Browser Detection Begin
 var is_opera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
 var is_Edge = navigator.userAgent.indexOf("Edge") > -1;
 var is_chrome = !!window.chrome && !is_opera && !is_Edge;
 var is_explorer= typeof document !== 'undefined' && !!document.documentMode && !is_Edge;
 var is_firefox = typeof window.InstallTrigger !== 'undefined';
 var is_safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
// Browser Detection End

(function(factory) { // eslint-disable-line no-extra-semi
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery'], factory);
    } else if (typeof module !== 'undefined' && module.exports) {
        // CommonJS
        module.exports = factory(require('jquery'));
    } else {
        // Global
        factory(jQuery);
    }
})(function($) {
    /*
    *  internal
    */

    var _previousResizeWidth = -1,
        _updateTimeout = -1;

    /*
    *  _parse
    *  value parse utility function
    */

    var _parse = function(value) {
        // parse value and convert NaN to 0
        return parseFloat(value) || 0;
    };

    /*
    *  _rows
    *  utility function returns array of jQuery selections representing each row
    *  (as displayed after float wrapping applied by browser)
    */

    var _rows = function(elements) {
        var tolerance = 1,
            $elements = $(elements),
            lastTop = null,
            rows = [];

        // group elements by their top position
        $elements.each(function(){
            var $that = $(this),
                top = $that.offset().top - _parse($that.css('margin-top')),
                lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

            if (lastRow === null) {
                // first item on the row, so just push it
                rows.push($that);
            } else {
                // if the row top is the same, add to the row group
                if (Math.floor(Math.abs(lastTop - top)) <= tolerance) {
                    rows[rows.length - 1] = lastRow.add($that);
                } else {
                    // otherwise start a new row group
                    rows.push($that);
                }
            }

            // keep track of the last row top
            lastTop = top;
        });

        return rows;
    };

    /*
    *  _parseOptions
    *  handle plugin options
    */

    var _parseOptions = function(options) {
        var opts = {
            byRow: true,
            property: 'height',
            target: null,
            remove: false
        };

        if (typeof options === 'object') {
            return $.extend(opts, options);
        }

        if (typeof options === 'boolean') {
            opts.byRow = options;
        } else if (options === 'remove') {
            opts.remove = true;
        }

        return opts;
    };

    /*
    *  matchHeight
    *  plugin definition
    */

    var matchHeight = $.fn.matchHeight = function(options) {
        var opts = _parseOptions(options);

        // handle remove
        if (opts.remove) {
            var that = this;

            // remove fixed height from all selected elements
            this.css(opts.property, '');

            // remove selected elements from all groups
            $.each(matchHeight._groups, function(key, group) {
                group.elements = group.elements.not(that);
            });

            // TODO: cleanup empty groups

            return this;
        }

        if (this.length <= 1 && !opts.target) {
            return this;
        }

        // keep track of this group so we can re-apply later on load and resize events
        matchHeight._groups.push({
            elements: this,
            options: opts
        });

        // match each element's height to the tallest element in the selection
        matchHeight._apply(this, opts);

        return this;
    };

    /*
    *  plugin global options
    */

    matchHeight.version = 'master';
    matchHeight._groups = [];
    matchHeight._throttle = 80;
    matchHeight._maintainScroll = false;
    matchHeight._beforeUpdate = null;
    matchHeight._afterUpdate = null;
    matchHeight._rows = _rows;
    matchHeight._parse = _parse;
    matchHeight._parseOptions = _parseOptions;

    /*
    *  matchHeight._apply
    *  apply matchHeight to given elements
    */

    matchHeight._apply = function(elements, options) {
        var opts = _parseOptions(options),
            $elements = $(elements),
            rows = [$elements];

        // take note of scroll position
        var scrollTop = $(window).scrollTop(),
            htmlHeight = $('html').outerHeight(true);

        // get hidden parents
        var $hiddenParents = $elements.parents().filter(':hidden');

        // cache the original inline style
        $hiddenParents.each(function() {
            var $that = $(this);
            $that.data('style-cache', $that.attr('style'));
        });

        // temporarily must force hidden parents visible
        $hiddenParents.css('display', 'block');

        // get rows if using byRow, otherwise assume one row
        if (opts.byRow && !opts.target) {

            // must first force an arbitrary equal height so floating elements break evenly
            $elements.each(function() {
                var $that = $(this),
                    display = $that.css('display');

                // temporarily force a usable display value
                if (display !== 'inline-block' && display !== 'flex' && display !== 'inline-flex') {
                    display = 'block';
                }

                // cache the original inline style
                $that.data('style-cache', $that.attr('style'));

                $that.css({
                    'display': display,
                    'padding-top': '0',
                    'padding-bottom': '0',
                    'margin-top': '0',
                    'margin-bottom': '0',
                    'border-top-width': '0',
                    'border-bottom-width': '0',
                    'height': '100px',
                    'overflow': 'hidden'
                });
            });

            // get the array of rows (based on element top position)
            rows = _rows($elements);

            // revert original inline styles
            $elements.each(function() {
                var $that = $(this);
                $that.attr('style', $that.data('style-cache') || '');
            });
        }

        $.each(rows, function(key, row) {
            var $row = $(row),
                targetHeight = 0;

            if (!opts.target) {
                // skip apply to rows with only one item
                if (opts.byRow && $row.length <= 1) {
                    $row.css(opts.property, '');
                    return;
                }

                // iterate the row and find the max height
                $row.each(function(){
                    var $that = $(this),
                        style = $that.attr('style'),
                        display = $that.css('display');

                    // temporarily force a usable display value
                    if (display !== 'inline-block' && display !== 'flex' && display !== 'inline-flex') {
                        display = 'block';
                    }

                    // ensure we get the correct actual height (and not a previously set height value)
                    var css = { 'display': display };
                    css[opts.property] = '';
                    $that.css(css);

                    // find the max height (including padding, but not margin)
                    if ($that.outerHeight(false) > targetHeight) {
                        targetHeight = $that.outerHeight(false);
                    }

                    // revert styles
                    if (style) {
                        $that.attr('style', style);
                    } else {
                        $that.css('display', '');
                    }
                });
            } else {
                // if target set, use the height of the target element
                targetHeight = opts.target.outerHeight(false);
            }

            // iterate the row and apply the height to all elements
            $row.each(function(){
                var $that = $(this),
                    verticalPadding = 0;

                // don't apply to a target
                if (opts.target && $that.is(opts.target)) {
                    return;
                }

                // handle padding and border correctly (required when not using border-box)
                if ($that.css('box-sizing') !== 'border-box') {
                    verticalPadding += _parse($that.css('border-top-width')) + _parse($that.css('border-bottom-width'));
                    verticalPadding += _parse($that.css('padding-top')) + _parse($that.css('padding-bottom'));
                }

                // set the height (accounting for padding and border)
                $that.css(opts.property, (targetHeight - verticalPadding) + 'px');
            });
        });

        // revert hidden parents
        $hiddenParents.each(function() {
            var $that = $(this);
            $that.attr('style', $that.data('style-cache') || null);
        });

        // restore scroll position if enabled
        if (matchHeight._maintainScroll) {
            $(window).scrollTop((scrollTop / htmlHeight) * $('html').outerHeight(true));
        }

        return this;
    };

    /*
    *  matchHeight._applyDataApi
    *  applies matchHeight to all elements with a data-match-height attribute
    */

    matchHeight._applyDataApi = function() {
        var groups = {};

        // generate groups by their groupId set by elements using data-match-height
        $('[data-match-height], [data-mh]').each(function() {
            var $this = $(this),
                groupId = $this.attr('data-mh') || $this.attr('data-match-height');

            if (groupId in groups) {
                groups[groupId] = groups[groupId].add($this);
            } else {
                groups[groupId] = $this;
            }
        });

        // apply matchHeight to each group
        $.each(groups, function() {
            this.matchHeight(true);
        });
    };

    /*
    *  matchHeight._update
    *  updates matchHeight on all current groups with their correct options
    */

    var _update = function(event) {
        if (matchHeight._beforeUpdate) {
            matchHeight._beforeUpdate(event, matchHeight._groups);
        }

        $.each(matchHeight._groups, function() {
            matchHeight._apply(this.elements, this.options);
        });

        if (matchHeight._afterUpdate) {
            matchHeight._afterUpdate(event, matchHeight._groups);
        }
    };

    matchHeight._update = function(throttle, event) {
        // prevent update if fired from a resize event
        // where the viewport width hasn't actually changed
        // fixes an event looping bug in IE8
        if (event && event.type === 'resize') {
            var windowWidth = $(window).width();
            if (windowWidth === _previousResizeWidth) {
                return;
            }
            _previousResizeWidth = windowWidth;
        }

        // throttle updates
        if (!throttle) {
            _update(event);
        } else if (_updateTimeout === -1) {
            _updateTimeout = setTimeout(function() {
                _update(event);
                _updateTimeout = -1;
            }, matchHeight._throttle);
        }
    };

    /*
    *  bind events
    */

    // apply on DOM ready event
    $(matchHeight._applyDataApi);

    // update heights on load and resize events
    $(window).bind('load', function(event) {
        matchHeight._update(false, event);
    });

    // throttled update heights on resize events
    $(window).bind('resize orientationchange', function(event) {
        matchHeight._update(true, event);
    });

});
;
!function(i){"use strict";"function"==typeof define&&define.amd?define(["jquery"],i):"undefined"!=typeof exports?module.exports=i(require("jquery")):i(jQuery)}(function(i){"use strict";var e=window.Slick||{};(e=function(){var e=0;return function(t,o){var s,n=this;n.defaults={accessibility:!0,adaptiveHeight:!1,appendArrows:i(t),appendDots:i(t),arrows:!0,asNavFor:null,prevArrow:'<button class="slick-prev" aria-label="Previous" type="button">Previous</button>',nextArrow:'<button class="slick-next" aria-label="Next" type="button">Next</button>',autoplay:!1,autoplaySpeed:3e3,centerMode:!1,centerPadding:"50px",cssEase:"ease",customPaging:function(e,t){return i('<button type="button" />').text(t+1)},dots:!1,dotsClass:"slick-dots",draggable:!0,easing:"linear",edgeFriction:.35,fade:!1,focusOnSelect:!1,focusOnChange:!1,infinite:!0,initialSlide:0,lazyLoad:"ondemand",mobileFirst:!1,pauseOnHover:!0,pauseOnFocus:!0,pauseOnDotsHover:!1,respondTo:"window",responsive:null,rows:1,rtl:!1,slide:"",slidesPerRow:1,slidesToShow:1,slidesToScroll:1,speed:500,swipe:!0,swipeToSlide:!1,touchMove:!0,touchThreshold:5,useCSS:!0,useTransform:!0,variableWidth:!1,vertical:!1,verticalSwiping:!1,waitForAnimate:!0,zIndex:1e3},n.initials={animating:!1,dragging:!1,autoPlayTimer:null,currentDirection:0,currentLeft:null,currentSlide:0,direction:1,$dots:null,listWidth:null,listHeight:null,loadIndex:0,$nextArrow:null,$prevArrow:null,scrolling:!1,slideCount:null,slideWidth:null,$slideTrack:null,$slides:null,sliding:!1,slideOffset:0,swipeLeft:null,swiping:!1,$list:null,touchObject:{},transformsEnabled:!1,unslicked:!1},i.extend(n,n.initials),n.activeBreakpoint=null,n.animType=null,n.animProp=null,n.breakpoints=[],n.breakpointSettings=[],n.cssTransitions=!1,n.focussed=!1,n.interrupted=!1,n.hidden="hidden",n.paused=!0,n.positionProp=null,n.respondTo=null,n.rowCount=1,n.shouldClick=!0,n.$slider=i(t),n.$slidesCache=null,n.transformType=null,n.transitionType=null,n.visibilityChange="visibilitychange",n.windowWidth=0,n.windowTimer=null,s=i(t).data("slick")||{},n.options=i.extend({},n.defaults,o,s),n.currentSlide=n.options.initialSlide,n.originalSettings=n.options,void 0!==document.mozHidden?(n.hidden="mozHidden",n.visibilityChange="mozvisibilitychange"):void 0!==document.webkitHidden&&(n.hidden="webkitHidden",n.visibilityChange="webkitvisibilitychange"),n.autoPlay=i.proxy(n.autoPlay,n),n.autoPlayClear=i.proxy(n.autoPlayClear,n),n.autoPlayIterator=i.proxy(n.autoPlayIterator,n),n.changeSlide=i.proxy(n.changeSlide,n),n.clickHandler=i.proxy(n.clickHandler,n),n.selectHandler=i.proxy(n.selectHandler,n),n.setPosition=i.proxy(n.setPosition,n),n.swipeHandler=i.proxy(n.swipeHandler,n),n.dragHandler=i.proxy(n.dragHandler,n),n.keyHandler=i.proxy(n.keyHandler,n),n.instanceUid=e++,n.htmlExpr=/^(?:\s*(<[\w\W]+>)[^>]*)$/,n.registerBreakpoints(),n.init(!0)}}()).prototype.activateADA=function(){this.$slideTrack.find(".slick-active").attr({"aria-hidden":"false"}).find("a, input, button, select").attr({tabindex:"0"})},e.prototype.addSlide=e.prototype.slickAdd=function(e,t,o){var s=this;if("boolean"==typeof t)o=t,t=null;else if(t<0||t>=s.slideCount)return!1;s.unload(),"number"==typeof t?0===t&&0===s.$slides.length?i(e).appendTo(s.$slideTrack):o?i(e).insertBefore(s.$slides.eq(t)):i(e).insertAfter(s.$slides.eq(t)):!0===o?i(e).prependTo(s.$slideTrack):i(e).appendTo(s.$slideTrack),s.$slides=s.$slideTrack.children(this.options.slide),s.$slideTrack.children(this.options.slide).detach(),s.$slideTrack.append(s.$slides),s.$slides.each(function(e,t){i(t).attr("data-slick-index",e)}),s.$slidesCache=s.$slides,s.reinit()},e.prototype.animateHeight=function(){var i=this;if(1===i.options.slidesToShow&&!0===i.options.adaptiveHeight&&!1===i.options.vertical){var e=i.$slides.eq(i.currentSlide).outerHeight(!0);i.$list.animate({height:e},i.options.speed)}},e.prototype.animateSlide=function(e,t){var o={},s=this;s.animateHeight(),!0===s.options.rtl&&!1===s.options.vertical&&(e=-e),!1===s.transformsEnabled?!1===s.options.vertical?s.$slideTrack.animate({left:e},s.options.speed,s.options.easing,t):s.$slideTrack.animate({top:e},s.options.speed,s.options.easing,t):!1===s.cssTransitions?(!0===s.options.rtl&&(s.currentLeft=-s.currentLeft),i({animStart:s.currentLeft}).animate({animStart:e},{duration:s.options.speed,easing:s.options.easing,step:function(i){i=Math.ceil(i),!1===s.options.vertical?(o[s.animType]="translate("+i+"px, 0px)",s.$slideTrack.css(o)):(o[s.animType]="translate(0px,"+i+"px)",s.$slideTrack.css(o))},complete:function(){t&&t.call()}})):(s.applyTransition(),e=Math.ceil(e),!1===s.options.vertical?o[s.animType]="translate3d("+e+"px, 0px, 0px)":o[s.animType]="translate3d(0px,"+e+"px, 0px)",s.$slideTrack.css(o),t&&setTimeout(function(){s.disableTransition(),t.call()},s.options.speed))},e.prototype.getNavTarget=function(){var e=this,t=e.options.asNavFor;return t&&null!==t&&(t=i(t).not(e.$slider)),t},e.prototype.asNavFor=function(e){var t=this.getNavTarget();null!==t&&"object"==typeof t&&t.each(function(){var t=i(this).slick("getSlick");t.unslicked||t.slideHandler(e,!0)})},e.prototype.applyTransition=function(i){var e=this,t={};!1===e.options.fade?t[e.transitionType]=e.transformType+" "+e.options.speed+"ms "+e.options.cssEase:t[e.transitionType]="opacity "+e.options.speed+"ms "+e.options.cssEase,!1===e.options.fade?e.$slideTrack.css(t):e.$slides.eq(i).css(t)},e.prototype.autoPlay=function(){var i=this;i.autoPlayClear(),i.slideCount>i.options.slidesToShow&&(i.autoPlayTimer=setInterval(i.autoPlayIterator,i.options.autoplaySpeed))},e.prototype.autoPlayClear=function(){var i=this;i.autoPlayTimer&&clearInterval(i.autoPlayTimer)},e.prototype.autoPlayIterator=function(){var i=this,e=i.currentSlide+i.options.slidesToScroll;i.paused||i.interrupted||i.focussed||(!1===i.options.infinite&&(1===i.direction&&i.currentSlide+1===i.slideCount-1?i.direction=0:0===i.direction&&(e=i.currentSlide-i.options.slidesToScroll,i.currentSlide-1==0&&(i.direction=1))),i.slideHandler(e))},e.prototype.buildArrows=function(){var e=this;!0===e.options.arrows&&(e.$prevArrow=i(e.options.prevArrow).addClass("slick-arrow"),e.$nextArrow=i(e.options.nextArrow).addClass("slick-arrow"),e.slideCount>e.options.slidesToShow?(e.$prevArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),e.$nextArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),e.htmlExpr.test(e.options.prevArrow)&&e.$prevArrow.prependTo(e.options.appendArrows),e.htmlExpr.test(e.options.nextArrow)&&e.$nextArrow.appendTo(e.options.appendArrows),!0!==e.options.infinite&&e.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true")):e.$prevArrow.add(e.$nextArrow).addClass("slick-hidden").attr({"aria-disabled":"true",tabindex:"-1"}))},e.prototype.buildDots=function(){var e,t,o=this;if(!0===o.options.dots){for(o.$slider.addClass("slick-dotted"),t=i("<ul />").addClass(o.options.dotsClass),e=0;e<=o.getDotCount();e+=1)t.append(i("<li />").append(o.options.customPaging.call(this,o,e)));o.$dots=t.appendTo(o.options.appendDots),o.$dots.find("li").first().addClass("slick-active")}},e.prototype.buildOut=function(){var e=this;e.$slides=e.$slider.children(e.options.slide+":not(.slick-cloned)").addClass("slick-slide"),e.slideCount=e.$slides.length,e.$slides.each(function(e,t){i(t).attr("data-slick-index",e).data("originalStyling",i(t).attr("style")||"")}),e.$slider.addClass("slick-slider"),e.$slideTrack=0===e.slideCount?i('<div class="slick-track"/>').appendTo(e.$slider):e.$slides.wrapAll('<div class="slick-track"/>').parent(),e.$list=e.$slideTrack.wrap('<div class="slick-list"/>').parent(),e.$slideTrack.css("opacity",0),!0!==e.options.centerMode&&!0!==e.options.swipeToSlide||(e.options.slidesToScroll=1),i("img[data-lazy]",e.$slider).not("[src]").addClass("slick-loading"),e.setupInfinite(),e.buildArrows(),e.buildDots(),e.updateDots(),e.setSlideClasses("number"==typeof e.currentSlide?e.currentSlide:0),!0===e.options.draggable&&e.$list.addClass("draggable")},e.prototype.buildRows=function(){var i,e,t,o,s,n,r,l=this;if(o=document.createDocumentFragment(),n=l.$slider.children(),l.options.rows>1){for(r=l.options.slidesPerRow*l.options.rows,s=Math.ceil(n.length/r),i=0;i<s;i++){var d=document.createElement("div");for(e=0;e<l.options.rows;e++){var a=document.createElement("div");for(t=0;t<l.options.slidesPerRow;t++){var c=i*r+(e*l.options.slidesPerRow+t);n.get(c)&&a.appendChild(n.get(c))}d.appendChild(a)}o.appendChild(d)}l.$slider.empty().append(o),l.$slider.children().children().children().css({width:100/l.options.slidesPerRow+"%",display:"inline-block"})}},e.prototype.checkResponsive=function(e,t){var o,s,n,r=this,l=!1,d=r.$slider.width(),a=window.innerWidth||i(window).width();if("window"===r.respondTo?n=a:"slider"===r.respondTo?n=d:"min"===r.respondTo&&(n=Math.min(a,d)),r.options.responsive&&r.options.responsive.length&&null!==r.options.responsive){s=null;for(o in r.breakpoints)r.breakpoints.hasOwnProperty(o)&&(!1===r.originalSettings.mobileFirst?n<r.breakpoints[o]&&(s=r.breakpoints[o]):n>r.breakpoints[o]&&(s=r.breakpoints[o]));null!==s?null!==r.activeBreakpoint?(s!==r.activeBreakpoint||t)&&(r.activeBreakpoint=s,"unslick"===r.breakpointSettings[s]?r.unslick(s):(r.options=i.extend({},r.originalSettings,r.breakpointSettings[s]),!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e)),l=s):(r.activeBreakpoint=s,"unslick"===r.breakpointSettings[s]?r.unslick(s):(r.options=i.extend({},r.originalSettings,r.breakpointSettings[s]),!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e)),l=s):null!==r.activeBreakpoint&&(r.activeBreakpoint=null,r.options=r.originalSettings,!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e),l=s),e||!1===l||r.$slider.trigger("breakpoint",[r,l])}},e.prototype.changeSlide=function(e,t){var o,s,n,r=this,l=i(e.currentTarget);switch(l.is("a")&&e.preventDefault(),l.is("li")||(l=l.closest("li")),n=r.slideCount%r.options.slidesToScroll!=0,o=n?0:(r.slideCount-r.currentSlide)%r.options.slidesToScroll,e.data.message){case"previous":s=0===o?r.options.slidesToScroll:r.options.slidesToShow-o,r.slideCount>r.options.slidesToShow&&r.slideHandler(r.currentSlide-s,!1,t);break;case"next":s=0===o?r.options.slidesToScroll:o,r.slideCount>r.options.slidesToShow&&r.slideHandler(r.currentSlide+s,!1,t);break;case"index":var d=0===e.data.index?0:e.data.index||l.index()*r.options.slidesToScroll;r.slideHandler(r.checkNavigable(d),!1,t),l.children().trigger("focus");break;default:return}},e.prototype.checkNavigable=function(i){var e,t;if(e=this.getNavigableIndexes(),t=0,i>e[e.length-1])i=e[e.length-1];else for(var o in e){if(i<e[o]){i=t;break}t=e[o]}return i},e.prototype.cleanUpEvents=function(){var e=this;e.options.dots&&null!==e.$dots&&(i("li",e.$dots).off("click.slick",e.changeSlide).off("mouseenter.slick",i.proxy(e.interrupt,e,!0)).off("mouseleave.slick",i.proxy(e.interrupt,e,!1)),!0===e.options.accessibility&&e.$dots.off("keydown.slick",e.keyHandler)),e.$slider.off("focus.slick blur.slick"),!0===e.options.arrows&&e.slideCount>e.options.slidesToShow&&(e.$prevArrow&&e.$prevArrow.off("click.slick",e.changeSlide),e.$nextArrow&&e.$nextArrow.off("click.slick",e.changeSlide),!0===e.options.accessibility&&(e.$prevArrow&&e.$prevArrow.off("keydown.slick",e.keyHandler),e.$nextArrow&&e.$nextArrow.off("keydown.slick",e.keyHandler))),e.$list.off("touchstart.slick mousedown.slick",e.swipeHandler),e.$list.off("touchmove.slick mousemove.slick",e.swipeHandler),e.$list.off("touchend.slick mouseup.slick",e.swipeHandler),e.$list.off("touchcancel.slick mouseleave.slick",e.swipeHandler),e.$list.off("click.slick",e.clickHandler),i(document).off(e.visibilityChange,e.visibility),e.cleanUpSlideEvents(),!0===e.options.accessibility&&e.$list.off("keydown.slick",e.keyHandler),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().off("click.slick",e.selectHandler),i(window).off("orientationchange.slick.slick-"+e.instanceUid,e.orientationChange),i(window).off("resize.slick.slick-"+e.instanceUid,e.resize),i("[draggable!=true]",e.$slideTrack).off("dragstart",e.preventDefault),i(window).off("load.slick.slick-"+e.instanceUid,e.setPosition)},e.prototype.cleanUpSlideEvents=function(){var e=this;e.$list.off("mouseenter.slick",i.proxy(e.interrupt,e,!0)),e.$list.off("mouseleave.slick",i.proxy(e.interrupt,e,!1))},e.prototype.cleanUpRows=function(){var i,e=this;e.options.rows>1&&((i=e.$slides.children().children()).removeAttr("style"),e.$slider.empty().append(i))},e.prototype.clickHandler=function(i){!1===this.shouldClick&&(i.stopImmediatePropagation(),i.stopPropagation(),i.preventDefault())},e.prototype.destroy=function(e){var t=this;t.autoPlayClear(),t.touchObject={},t.cleanUpEvents(),i(".slick-cloned",t.$slider).detach(),t.$dots&&t.$dots.remove(),t.$prevArrow&&t.$prevArrow.length&&(t.$prevArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),t.htmlExpr.test(t.options.prevArrow)&&t.$prevArrow.remove()),t.$nextArrow&&t.$nextArrow.length&&(t.$nextArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),t.htmlExpr.test(t.options.nextArrow)&&t.$nextArrow.remove()),t.$slides&&(t.$slides.removeClass("slick-slide slick-active slick-center slick-visible slick-current").removeAttr("aria-hidden").removeAttr("data-slick-index").each(function(){i(this).attr("style",i(this).data("originalStyling"))}),t.$slideTrack.children(this.options.slide).detach(),t.$slideTrack.detach(),t.$list.detach(),t.$slider.append(t.$slides)),t.cleanUpRows(),t.$slider.removeClass("slick-slider"),t.$slider.removeClass("slick-initialized"),t.$slider.removeClass("slick-dotted"),t.unslicked=!0,e||t.$slider.trigger("destroy",[t])},e.prototype.disableTransition=function(i){var e=this,t={};t[e.transitionType]="",!1===e.options.fade?e.$slideTrack.css(t):e.$slides.eq(i).css(t)},e.prototype.fadeSlide=function(i,e){var t=this;!1===t.cssTransitions?(t.$slides.eq(i).css({zIndex:t.options.zIndex}),t.$slides.eq(i).animate({opacity:1},t.options.speed,t.options.easing,e)):(t.applyTransition(i),t.$slides.eq(i).css({opacity:1,zIndex:t.options.zIndex}),e&&setTimeout(function(){t.disableTransition(i),e.call()},t.options.speed))},e.prototype.fadeSlideOut=function(i){var e=this;!1===e.cssTransitions?e.$slides.eq(i).animate({opacity:0,zIndex:e.options.zIndex-2},e.options.speed,e.options.easing):(e.applyTransition(i),e.$slides.eq(i).css({opacity:0,zIndex:e.options.zIndex-2}))},e.prototype.filterSlides=e.prototype.slickFilter=function(i){var e=this;null!==i&&(e.$slidesCache=e.$slides,e.unload(),e.$slideTrack.children(this.options.slide).detach(),e.$slidesCache.filter(i).appendTo(e.$slideTrack),e.reinit())},e.prototype.focusHandler=function(){var e=this;e.$slider.off("focus.slick blur.slick").on("focus.slick blur.slick","*",function(t){t.stopImmediatePropagation();var o=i(this);setTimeout(function(){e.options.pauseOnFocus&&(e.focussed=o.is(":focus"),e.autoPlay())},0)})},e.prototype.getCurrent=e.prototype.slickCurrentSlide=function(){return this.currentSlide},e.prototype.getDotCount=function(){var i=this,e=0,t=0,o=0;if(!0===i.options.infinite)if(i.slideCount<=i.options.slidesToShow)++o;else for(;e<i.slideCount;)++o,e=t+i.options.slidesToScroll,t+=i.options.slidesToScroll<=i.options.slidesToShow?i.options.slidesToScroll:i.options.slidesToShow;else if(!0===i.options.centerMode)o=i.slideCount;else if(i.options.asNavFor)for(;e<i.slideCount;)++o,e=t+i.options.slidesToScroll,t+=i.options.slidesToScroll<=i.options.slidesToShow?i.options.slidesToScroll:i.options.slidesToShow;else o=1+Math.ceil((i.slideCount-i.options.slidesToShow)/i.options.slidesToScroll);return o-1},e.prototype.getLeft=function(i){var e,t,o,s,n=this,r=0;return n.slideOffset=0,t=n.$slides.first().outerHeight(!0),!0===n.options.infinite?(n.slideCount>n.options.slidesToShow&&(n.slideOffset=n.slideWidth*n.options.slidesToShow*-1,s=-1,!0===n.options.vertical&&!0===n.options.centerMode&&(2===n.options.slidesToShow?s=-1.5:1===n.options.slidesToShow&&(s=-2)),r=t*n.options.slidesToShow*s),n.slideCount%n.options.slidesToScroll!=0&&i+n.options.slidesToScroll>n.slideCount&&n.slideCount>n.options.slidesToShow&&(i>n.slideCount?(n.slideOffset=(n.options.slidesToShow-(i-n.slideCount))*n.slideWidth*-1,r=(n.options.slidesToShow-(i-n.slideCount))*t*-1):(n.slideOffset=n.slideCount%n.options.slidesToScroll*n.slideWidth*-1,r=n.slideCount%n.options.slidesToScroll*t*-1))):i+n.options.slidesToShow>n.slideCount&&(n.slideOffset=(i+n.options.slidesToShow-n.slideCount)*n.slideWidth,r=(i+n.options.slidesToShow-n.slideCount)*t),n.slideCount<=n.options.slidesToShow&&(n.slideOffset=0,r=0),!0===n.options.centerMode&&n.slideCount<=n.options.slidesToShow?n.slideOffset=n.slideWidth*Math.floor(n.options.slidesToShow)/2-n.slideWidth*n.slideCount/2:!0===n.options.centerMode&&!0===n.options.infinite?n.slideOffset+=n.slideWidth*Math.floor(n.options.slidesToShow/2)-n.slideWidth:!0===n.options.centerMode&&(n.slideOffset=0,n.slideOffset+=n.slideWidth*Math.floor(n.options.slidesToShow/2)),e=!1===n.options.vertical?i*n.slideWidth*-1+n.slideOffset:i*t*-1+r,!0===n.options.variableWidth&&(o=n.slideCount<=n.options.slidesToShow||!1===n.options.infinite?n.$slideTrack.children(".slick-slide").eq(i):n.$slideTrack.children(".slick-slide").eq(i+n.options.slidesToShow),e=!0===n.options.rtl?o[0]?-1*(n.$slideTrack.width()-o[0].offsetLeft-o.width()):0:o[0]?-1*o[0].offsetLeft:0,!0===n.options.centerMode&&(o=n.slideCount<=n.options.slidesToShow||!1===n.options.infinite?n.$slideTrack.children(".slick-slide").eq(i):n.$slideTrack.children(".slick-slide").eq(i+n.options.slidesToShow+1),e=!0===n.options.rtl?o[0]?-1*(n.$slideTrack.width()-o[0].offsetLeft-o.width()):0:o[0]?-1*o[0].offsetLeft:0,e+=(n.$list.width()-o.outerWidth())/2)),e},e.prototype.getOption=e.prototype.slickGetOption=function(i){return this.options[i]},e.prototype.getNavigableIndexes=function(){var i,e=this,t=0,o=0,s=[];for(!1===e.options.infinite?i=e.slideCount:(t=-1*e.options.slidesToScroll,o=-1*e.options.slidesToScroll,i=2*e.slideCount);t<i;)s.push(t),t=o+e.options.slidesToScroll,o+=e.options.slidesToScroll<=e.options.slidesToShow?e.options.slidesToScroll:e.options.slidesToShow;return s},e.prototype.getSlick=function(){return this},e.prototype.getSlideCount=function(){var e,t,o=this;return t=!0===o.options.centerMode?o.slideWidth*Math.floor(o.options.slidesToShow/2):0,!0===o.options.swipeToSlide?(o.$slideTrack.find(".slick-slide").each(function(s,n){if(n.offsetLeft-t+i(n).outerWidth()/2>-1*o.swipeLeft)return e=n,!1}),Math.abs(i(e).attr("data-slick-index")-o.currentSlide)||1):o.options.slidesToScroll},e.prototype.goTo=e.prototype.slickGoTo=function(i,e){this.changeSlide({data:{message:"index",index:parseInt(i)}},e)},e.prototype.init=function(e){var t=this;i(t.$slider).hasClass("slick-initialized")||(i(t.$slider).addClass("slick-initialized"),t.buildRows(),t.buildOut(),t.setProps(),t.startLoad(),t.loadSlider(),t.initializeEvents(),t.updateArrows(),t.updateDots(),t.checkResponsive(!0),t.focusHandler()),e&&t.$slider.trigger("init",[t]),!0===t.options.accessibility&&t.initADA(),t.options.autoplay&&(t.paused=!1,t.autoPlay())},e.prototype.initADA=function(){var e=this,t=Math.ceil(e.slideCount/e.options.slidesToShow),o=e.getNavigableIndexes().filter(function(i){return i>=0&&i<e.slideCount});e.$slides.add(e.$slideTrack.find(".slick-cloned")).attr({"aria-hidden":"true",tabindex:"-1"}).find("a, input, button, select").attr({tabindex:"-1"}),null!==e.$dots&&(e.$slides.not(e.$slideTrack.find(".slick-cloned")).each(function(t){var s=o.indexOf(t);i(this).attr({role:"tabpanel",id:"slick-slide"+e.instanceUid+t,tabindex:-1}),-1!==s&&i(this).attr({"aria-describedby":"slick-slide-control"+e.instanceUid+s})}),e.$dots.attr("role","tablist").find("li").each(function(s){var n=o[s];i(this).attr({role:"presentation"}),i(this).find("button").first().attr({role:"tab",id:"slick-slide-control"+e.instanceUid+s,"aria-controls":"slick-slide"+e.instanceUid+n,"aria-label":s+1+" of "+t,"aria-selected":null,tabindex:"-1"})}).eq(e.currentSlide).find("button").attr({"aria-selected":"true",tabindex:"0"}).end());for(var s=e.currentSlide,n=s+e.options.slidesToShow;s<n;s++)e.$slides.eq(s).attr("tabindex",0);e.activateADA()},e.prototype.initArrowEvents=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.off("click.slick").on("click.slick",{message:"previous"},i.changeSlide),i.$nextArrow.off("click.slick").on("click.slick",{message:"next"},i.changeSlide),!0===i.options.accessibility&&(i.$prevArrow.on("keydown.slick",i.keyHandler),i.$nextArrow.on("keydown.slick",i.keyHandler)))},e.prototype.initDotEvents=function(){var e=this;!0===e.options.dots&&(i("li",e.$dots).on("click.slick",{message:"index"},e.changeSlide),!0===e.options.accessibility&&e.$dots.on("keydown.slick",e.keyHandler)),!0===e.options.dots&&!0===e.options.pauseOnDotsHover&&i("li",e.$dots).on("mouseenter.slick",i.proxy(e.interrupt,e,!0)).on("mouseleave.slick",i.proxy(e.interrupt,e,!1))},e.prototype.initSlideEvents=function(){var e=this;e.options.pauseOnHover&&(e.$list.on("mouseenter.slick",i.proxy(e.interrupt,e,!0)),e.$list.on("mouseleave.slick",i.proxy(e.interrupt,e,!1)))},e.prototype.initializeEvents=function(){var e=this;e.initArrowEvents(),e.initDotEvents(),e.initSlideEvents(),e.$list.on("touchstart.slick mousedown.slick",{action:"start"},e.swipeHandler),e.$list.on("touchmove.slick mousemove.slick",{action:"move"},e.swipeHandler),e.$list.on("touchend.slick mouseup.slick",{action:"end"},e.swipeHandler),e.$list.on("touchcancel.slick mouseleave.slick",{action:"end"},e.swipeHandler),e.$list.on("click.slick",e.clickHandler),i(document).on(e.visibilityChange,i.proxy(e.visibility,e)),!0===e.options.accessibility&&e.$list.on("keydown.slick",e.keyHandler),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().on("click.slick",e.selectHandler),i(window).on("orientationchange.slick.slick-"+e.instanceUid,i.proxy(e.orientationChange,e)),i(window).on("resize.slick.slick-"+e.instanceUid,i.proxy(e.resize,e)),i("[draggable!=true]",e.$slideTrack).on("dragstart",e.preventDefault),i(window).on("load.slick.slick-"+e.instanceUid,e.setPosition),i(e.setPosition)},e.prototype.initUI=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.show(),i.$nextArrow.show()),!0===i.options.dots&&i.slideCount>i.options.slidesToShow&&i.$dots.show()},e.prototype.keyHandler=function(i){var e=this;i.target.tagName.match("TEXTAREA|INPUT|SELECT")||(37===i.keyCode&&!0===e.options.accessibility?e.changeSlide({data:{message:!0===e.options.rtl?"next":"previous"}}):39===i.keyCode&&!0===e.options.accessibility&&e.changeSlide({data:{message:!0===e.options.rtl?"previous":"next"}}))},e.prototype.lazyLoad=function(){function e(e){i("img[data-lazy]",e).each(function(){var e=i(this),t=i(this).attr("data-lazy"),o=i(this).attr("data-srcset"),s=i(this).attr("data-sizes")||n.$slider.attr("data-sizes"),r=document.createElement("img");r.onload=function(){e.animate({opacity:0},100,function(){o&&(e.attr("srcset",o),s&&e.attr("sizes",s)),e.attr("src",t).animate({opacity:1},200,function(){e.removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading")}),n.$slider.trigger("lazyLoaded",[n,e,t])})},r.onerror=function(){e.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"),n.$slider.trigger("lazyLoadError",[n,e,t])},r.src=t})}var t,o,s,n=this;if(!0===n.options.centerMode?!0===n.options.infinite?s=(o=n.currentSlide+(n.options.slidesToShow/2+1))+n.options.slidesToShow+2:(o=Math.max(0,n.currentSlide-(n.options.slidesToShow/2+1)),s=n.options.slidesToShow/2+1+2+n.currentSlide):(o=n.options.infinite?n.options.slidesToShow+n.currentSlide:n.currentSlide,s=Math.ceil(o+n.options.slidesToShow),!0===n.options.fade&&(o>0&&o--,s<=n.slideCount&&s++)),t=n.$slider.find(".slick-slide").slice(o,s),"anticipated"===n.options.lazyLoad)for(var r=o-1,l=s,d=n.$slider.find(".slick-slide"),a=0;a<n.options.slidesToScroll;a++)r<0&&(r=n.slideCount-1),t=(t=t.add(d.eq(r))).add(d.eq(l)),r--,l++;e(t),n.slideCount<=n.options.slidesToShow?e(n.$slider.find(".slick-slide")):n.currentSlide>=n.slideCount-n.options.slidesToShow?e(n.$slider.find(".slick-cloned").slice(0,n.options.slidesToShow)):0===n.currentSlide&&e(n.$slider.find(".slick-cloned").slice(-1*n.options.slidesToShow))},e.prototype.loadSlider=function(){var i=this;i.setPosition(),i.$slideTrack.css({opacity:1}),i.$slider.removeClass("slick-loading"),i.initUI(),"progressive"===i.options.lazyLoad&&i.progressiveLazyLoad()},e.prototype.next=e.prototype.slickNext=function(){this.changeSlide({data:{message:"next"}})},e.prototype.orientationChange=function(){var i=this;i.checkResponsive(),i.setPosition()},e.prototype.pause=e.prototype.slickPause=function(){var i=this;i.autoPlayClear(),i.paused=!0},e.prototype.play=e.prototype.slickPlay=function(){var i=this;i.autoPlay(),i.options.autoplay=!0,i.paused=!1,i.focussed=!1,i.interrupted=!1},e.prototype.postSlide=function(e){var t=this;t.unslicked||(t.$slider.trigger("afterChange",[t,e]),t.animating=!1,t.slideCount>t.options.slidesToShow&&t.setPosition(),t.swipeLeft=null,t.options.autoplay&&t.autoPlay(),!0===t.options.accessibility&&(t.initADA(),t.options.focusOnChange&&i(t.$slides.get(t.currentSlide)).attr("tabindex",0).focus()))},e.prototype.prev=e.prototype.slickPrev=function(){this.changeSlide({data:{message:"previous"}})},e.prototype.preventDefault=function(i){i.preventDefault()},e.prototype.progressiveLazyLoad=function(e){e=e||1;var t,o,s,n,r,l=this,d=i("img[data-lazy]",l.$slider);d.length?(t=d.first(),o=t.attr("data-lazy"),s=t.attr("data-srcset"),n=t.attr("data-sizes")||l.$slider.attr("data-sizes"),(r=document.createElement("img")).onload=function(){s&&(t.attr("srcset",s),n&&t.attr("sizes",n)),t.attr("src",o).removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading"),!0===l.options.adaptiveHeight&&l.setPosition(),l.$slider.trigger("lazyLoaded",[l,t,o]),l.progressiveLazyLoad()},r.onerror=function(){e<3?setTimeout(function(){l.progressiveLazyLoad(e+1)},500):(t.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"),l.$slider.trigger("lazyLoadError",[l,t,o]),l.progressiveLazyLoad())},r.src=o):l.$slider.trigger("allImagesLoaded",[l])},e.prototype.refresh=function(e){var t,o,s=this;o=s.slideCount-s.options.slidesToShow,!s.options.infinite&&s.currentSlide>o&&(s.currentSlide=o),s.slideCount<=s.options.slidesToShow&&(s.currentSlide=0),t=s.currentSlide,s.destroy(!0),i.extend(s,s.initials,{currentSlide:t}),s.init(),e||s.changeSlide({data:{message:"index",index:t}},!1)},e.prototype.registerBreakpoints=function(){var e,t,o,s=this,n=s.options.responsive||null;if("array"===i.type(n)&&n.length){s.respondTo=s.options.respondTo||"window";for(e in n)if(o=s.breakpoints.length-1,n.hasOwnProperty(e)){for(t=n[e].breakpoint;o>=0;)s.breakpoints[o]&&s.breakpoints[o]===t&&s.breakpoints.splice(o,1),o--;s.breakpoints.push(t),s.breakpointSettings[t]=n[e].settings}s.breakpoints.sort(function(i,e){return s.options.mobileFirst?i-e:e-i})}},e.prototype.reinit=function(){var e=this;e.$slides=e.$slideTrack.children(e.options.slide).addClass("slick-slide"),e.slideCount=e.$slides.length,e.currentSlide>=e.slideCount&&0!==e.currentSlide&&(e.currentSlide=e.currentSlide-e.options.slidesToScroll),e.slideCount<=e.options.slidesToShow&&(e.currentSlide=0),e.registerBreakpoints(),e.setProps(),e.setupInfinite(),e.buildArrows(),e.updateArrows(),e.initArrowEvents(),e.buildDots(),e.updateDots(),e.initDotEvents(),e.cleanUpSlideEvents(),e.initSlideEvents(),e.checkResponsive(!1,!0),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().on("click.slick",e.selectHandler),e.setSlideClasses("number"==typeof e.currentSlide?e.currentSlide:0),e.setPosition(),e.focusHandler(),e.paused=!e.options.autoplay,e.autoPlay(),e.$slider.trigger("reInit",[e])},e.prototype.resize=function(){var e=this;i(window).width()!==e.windowWidth&&(clearTimeout(e.windowDelay),e.windowDelay=window.setTimeout(function(){e.windowWidth=i(window).width(),e.checkResponsive(),e.unslicked||e.setPosition()},50))},e.prototype.removeSlide=e.prototype.slickRemove=function(i,e,t){var o=this;if(i="boolean"==typeof i?!0===(e=i)?0:o.slideCount-1:!0===e?--i:i,o.slideCount<1||i<0||i>o.slideCount-1)return!1;o.unload(),!0===t?o.$slideTrack.children().remove():o.$slideTrack.children(this.options.slide).eq(i).remove(),o.$slides=o.$slideTrack.children(this.options.slide),o.$slideTrack.children(this.options.slide).detach(),o.$slideTrack.append(o.$slides),o.$slidesCache=o.$slides,o.reinit()},e.prototype.setCSS=function(i){var e,t,o=this,s={};!0===o.options.rtl&&(i=-i),e="left"==o.positionProp?Math.ceil(i)+"px":"0px",t="top"==o.positionProp?Math.ceil(i)+"px":"0px",s[o.positionProp]=i,!1===o.transformsEnabled?o.$slideTrack.css(s):(s={},!1===o.cssTransitions?(s[o.animType]="translate("+e+", "+t+")",o.$slideTrack.css(s)):(s[o.animType]="translate3d("+e+", "+t+", 0px)",o.$slideTrack.css(s)))},e.prototype.setDimensions=function(){var i=this;!1===i.options.vertical?!0===i.options.centerMode&&i.$list.css({padding:"0px "+i.options.centerPadding}):(i.$list.height(i.$slides.first().outerHeight(!0)*i.options.slidesToShow),!0===i.options.centerMode&&i.$list.css({padding:i.options.centerPadding+" 0px"})),i.listWidth=i.$list.width(),i.listHeight=i.$list.height(),!1===i.options.vertical&&!1===i.options.variableWidth?(i.slideWidth=Math.ceil(i.listWidth/i.options.slidesToShow),i.$slideTrack.width(Math.ceil(i.slideWidth*i.$slideTrack.children(".slick-slide").length))):!0===i.options.variableWidth?i.$slideTrack.width(5e3*i.slideCount):(i.slideWidth=Math.ceil(i.listWidth),i.$slideTrack.height(Math.ceil(i.$slides.first().outerHeight(!0)*i.$slideTrack.children(".slick-slide").length)));var e=i.$slides.first().outerWidth(!0)-i.$slides.first().width();!1===i.options.variableWidth&&i.$slideTrack.children(".slick-slide").width(i.slideWidth-e)},e.prototype.setFade=function(){var e,t=this;t.$slides.each(function(o,s){e=t.slideWidth*o*-1,!0===t.options.rtl?i(s).css({position:"relative",right:e,top:0,zIndex:t.options.zIndex-2,opacity:0}):i(s).css({position:"relative",left:e,top:0,zIndex:t.options.zIndex-2,opacity:0})}),t.$slides.eq(t.currentSlide).css({zIndex:t.options.zIndex-1,opacity:1})},e.prototype.setHeight=function(){var i=this;if(1===i.options.slidesToShow&&!0===i.options.adaptiveHeight&&!1===i.options.vertical){var e=i.$slides.eq(i.currentSlide).outerHeight(!0);i.$list.css("height",e)}},e.prototype.setOption=e.prototype.slickSetOption=function(){var e,t,o,s,n,r=this,l=!1;if("object"===i.type(arguments[0])?(o=arguments[0],l=arguments[1],n="multiple"):"string"===i.type(arguments[0])&&(o=arguments[0],s=arguments[1],l=arguments[2],"responsive"===arguments[0]&&"array"===i.type(arguments[1])?n="responsive":void 0!==arguments[1]&&(n="single")),"single"===n)r.options[o]=s;else if("multiple"===n)i.each(o,function(i,e){r.options[i]=e});else if("responsive"===n)for(t in s)if("array"!==i.type(r.options.responsive))r.options.responsive=[s[t]];else{for(e=r.options.responsive.length-1;e>=0;)r.options.responsive[e].breakpoint===s[t].breakpoint&&r.options.responsive.splice(e,1),e--;r.options.responsive.push(s[t])}l&&(r.unload(),r.reinit())},e.prototype.setPosition=function(){var i=this;i.setDimensions(),i.setHeight(),!1===i.options.fade?i.setCSS(i.getLeft(i.currentSlide)):i.setFade(),i.$slider.trigger("setPosition",[i])},e.prototype.setProps=function(){var i=this,e=document.body.style;i.positionProp=!0===i.options.vertical?"top":"left","top"===i.positionProp?i.$slider.addClass("slick-vertical"):i.$slider.removeClass("slick-vertical"),void 0===e.WebkitTransition&&void 0===e.MozTransition&&void 0===e.msTransition||!0===i.options.useCSS&&(i.cssTransitions=!0),i.options.fade&&("number"==typeof i.options.zIndex?i.options.zIndex<3&&(i.options.zIndex=3):i.options.zIndex=i.defaults.zIndex),void 0!==e.OTransform&&(i.animType="OTransform",i.transformType="-o-transform",i.transitionType="OTransition",void 0===e.perspectiveProperty&&void 0===e.webkitPerspective&&(i.animType=!1)),void 0!==e.MozTransform&&(i.animType="MozTransform",i.transformType="-moz-transform",i.transitionType="MozTransition",void 0===e.perspectiveProperty&&void 0===e.MozPerspective&&(i.animType=!1)),void 0!==e.webkitTransform&&(i.animType="webkitTransform",i.transformType="-webkit-transform",i.transitionType="webkitTransition",void 0===e.perspectiveProperty&&void 0===e.webkitPerspective&&(i.animType=!1)),void 0!==e.msTransform&&(i.animType="msTransform",i.transformType="-ms-transform",i.transitionType="msTransition",void 0===e.msTransform&&(i.animType=!1)),void 0!==e.transform&&!1!==i.animType&&(i.animType="transform",i.transformType="transform",i.transitionType="transition"),i.transformsEnabled=i.options.useTransform&&null!==i.animType&&!1!==i.animType},e.prototype.setSlideClasses=function(i){var e,t,o,s,n=this;if(t=n.$slider.find(".slick-slide").removeClass("slick-active slick-center slick-current").attr("aria-hidden","true"),n.$slides.eq(i).addClass("slick-current"),!0===n.options.centerMode){var r=n.options.slidesToShow%2==0?1:0;e=Math.floor(n.options.slidesToShow/2),!0===n.options.infinite&&(i>=e&&i<=n.slideCount-1-e?n.$slides.slice(i-e+r,i+e+1).addClass("slick-active").attr("aria-hidden","false"):(o=n.options.slidesToShow+i,t.slice(o-e+1+r,o+e+2).addClass("slick-active").attr("aria-hidden","false")),0===i?t.eq(t.length-1-n.options.slidesToShow).addClass("slick-center"):i===n.slideCount-1&&t.eq(n.options.slidesToShow).addClass("slick-center")),n.$slides.eq(i).addClass("slick-center")}else i>=0&&i<=n.slideCount-n.options.slidesToShow?n.$slides.slice(i,i+n.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"):t.length<=n.options.slidesToShow?t.addClass("slick-active").attr("aria-hidden","false"):(s=n.slideCount%n.options.slidesToShow,o=!0===n.options.infinite?n.options.slidesToShow+i:i,n.options.slidesToShow==n.options.slidesToScroll&&n.slideCount-i<n.options.slidesToShow?t.slice(o-(n.options.slidesToShow-s),o+s).addClass("slick-active").attr("aria-hidden","false"):t.slice(o,o+n.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"));"ondemand"!==n.options.lazyLoad&&"anticipated"!==n.options.lazyLoad||n.lazyLoad()},e.prototype.setupInfinite=function(){var e,t,o,s=this;if(!0===s.options.fade&&(s.options.centerMode=!1),!0===s.options.infinite&&!1===s.options.fade&&(t=null,s.slideCount>s.options.slidesToShow)){for(o=!0===s.options.centerMode?s.options.slidesToShow+1:s.options.slidesToShow,e=s.slideCount;e>s.slideCount-o;e-=1)t=e-1,i(s.$slides[t]).clone(!0).attr("id","").attr("data-slick-index",t-s.slideCount).prependTo(s.$slideTrack).addClass("slick-cloned");for(e=0;e<o+s.slideCount;e+=1)t=e,i(s.$slides[t]).clone(!0).attr("id","").attr("data-slick-index",t+s.slideCount).appendTo(s.$slideTrack).addClass("slick-cloned");s.$slideTrack.find(".slick-cloned").find("[id]").each(function(){i(this).attr("id","")})}},e.prototype.interrupt=function(i){var e=this;i||e.autoPlay(),e.interrupted=i},e.prototype.selectHandler=function(e){var t=this,o=i(e.target).is(".slick-slide")?i(e.target):i(e.target).parents(".slick-slide"),s=parseInt(o.attr("data-slick-index"));s||(s=0),t.slideCount<=t.options.slidesToShow?t.slideHandler(s,!1,!0):t.slideHandler(s)},e.prototype.slideHandler=function(i,e,t){var o,s,n,r,l,d=null,a=this;if(e=e||!1,!(!0===a.animating&&!0===a.options.waitForAnimate||!0===a.options.fade&&a.currentSlide===i))if(!1===e&&a.asNavFor(i),o=i,d=a.getLeft(o),r=a.getLeft(a.currentSlide),a.currentLeft=null===a.swipeLeft?r:a.swipeLeft,!1===a.options.infinite&&!1===a.options.centerMode&&(i<0||i>a.getDotCount()*a.options.slidesToScroll))!1===a.options.fade&&(o=a.currentSlide,!0!==t?a.animateSlide(r,function(){a.postSlide(o)}):a.postSlide(o));else if(!1===a.options.infinite&&!0===a.options.centerMode&&(i<0||i>a.slideCount-a.options.slidesToScroll))!1===a.options.fade&&(o=a.currentSlide,!0!==t?a.animateSlide(r,function(){a.postSlide(o)}):a.postSlide(o));else{if(a.options.autoplay&&clearInterval(a.autoPlayTimer),s=o<0?a.slideCount%a.options.slidesToScroll!=0?a.slideCount-a.slideCount%a.options.slidesToScroll:a.slideCount+o:o>=a.slideCount?a.slideCount%a.options.slidesToScroll!=0?0:o-a.slideCount:o,a.animating=!0,a.$slider.trigger("beforeChange",[a,a.currentSlide,s]),n=a.currentSlide,a.currentSlide=s,a.setSlideClasses(a.currentSlide),a.options.asNavFor&&(l=(l=a.getNavTarget()).slick("getSlick")).slideCount<=l.options.slidesToShow&&l.setSlideClasses(a.currentSlide),a.updateDots(),a.updateArrows(),!0===a.options.fade)return!0!==t?(a.fadeSlideOut(n),a.fadeSlide(s,function(){a.postSlide(s)})):a.postSlide(s),void a.animateHeight();!0!==t?a.animateSlide(d,function(){a.postSlide(s)}):a.postSlide(s)}},e.prototype.startLoad=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.hide(),i.$nextArrow.hide()),!0===i.options.dots&&i.slideCount>i.options.slidesToShow&&i.$dots.hide(),i.$slider.addClass("slick-loading")},e.prototype.swipeDirection=function(){var i,e,t,o,s=this;return i=s.touchObject.startX-s.touchObject.curX,e=s.touchObject.startY-s.touchObject.curY,t=Math.atan2(e,i),(o=Math.round(180*t/Math.PI))<0&&(o=360-Math.abs(o)),o<=45&&o>=0?!1===s.options.rtl?"left":"right":o<=360&&o>=315?!1===s.options.rtl?"left":"right":o>=135&&o<=225?!1===s.options.rtl?"right":"left":!0===s.options.verticalSwiping?o>=35&&o<=135?"down":"up":"vertical"},e.prototype.swipeEnd=function(i){var e,t,o=this;if(o.dragging=!1,o.swiping=!1,o.scrolling)return o.scrolling=!1,!1;if(o.interrupted=!1,o.shouldClick=!(o.touchObject.swipeLength>10),void 0===o.touchObject.curX)return!1;if(!0===o.touchObject.edgeHit&&o.$slider.trigger("edge",[o,o.swipeDirection()]),o.touchObject.swipeLength>=o.touchObject.minSwipe){switch(t=o.swipeDirection()){case"left":case"down":e=o.options.swipeToSlide?o.checkNavigable(o.currentSlide+o.getSlideCount()):o.currentSlide+o.getSlideCount(),o.currentDirection=0;break;case"right":case"up":e=o.options.swipeToSlide?o.checkNavigable(o.currentSlide-o.getSlideCount()):o.currentSlide-o.getSlideCount(),o.currentDirection=1}"vertical"!=t&&(o.slideHandler(e),o.touchObject={},o.$slider.trigger("swipe",[o,t]))}else o.touchObject.startX!==o.touchObject.curX&&(o.slideHandler(o.currentSlide),o.touchObject={})},e.prototype.swipeHandler=function(i){var e=this;if(!(!1===e.options.swipe||"ontouchend"in document&&!1===e.options.swipe||!1===e.options.draggable&&-1!==i.type.indexOf("mouse")))switch(e.touchObject.fingerCount=i.originalEvent&&void 0!==i.originalEvent.touches?i.originalEvent.touches.length:1,e.touchObject.minSwipe=e.listWidth/e.options.touchThreshold,!0===e.options.verticalSwiping&&(e.touchObject.minSwipe=e.listHeight/e.options.touchThreshold),i.data.action){case"start":e.swipeStart(i);break;case"move":e.swipeMove(i);break;case"end":e.swipeEnd(i)}},e.prototype.swipeMove=function(i){var e,t,o,s,n,r,l=this;return n=void 0!==i.originalEvent?i.originalEvent.touches:null,!(!l.dragging||l.scrolling||n&&1!==n.length)&&(e=l.getLeft(l.currentSlide),l.touchObject.curX=void 0!==n?n[0].pageX:i.clientX,l.touchObject.curY=void 0!==n?n[0].pageY:i.clientY,l.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(l.touchObject.curX-l.touchObject.startX,2))),r=Math.round(Math.sqrt(Math.pow(l.touchObject.curY-l.touchObject.startY,2))),!l.options.verticalSwiping&&!l.swiping&&r>4?(l.scrolling=!0,!1):(!0===l.options.verticalSwiping&&(l.touchObject.swipeLength=r),t=l.swipeDirection(),void 0!==i.originalEvent&&l.touchObject.swipeLength>4&&(l.swiping=!0,i.preventDefault()),s=(!1===l.options.rtl?1:-1)*(l.touchObject.curX>l.touchObject.startX?1:-1),!0===l.options.verticalSwiping&&(s=l.touchObject.curY>l.touchObject.startY?1:-1),o=l.touchObject.swipeLength,l.touchObject.edgeHit=!1,!1===l.options.infinite&&(0===l.currentSlide&&"right"===t||l.currentSlide>=l.getDotCount()&&"left"===t)&&(o=l.touchObject.swipeLength*l.options.edgeFriction,l.touchObject.edgeHit=!0),!1===l.options.vertical?l.swipeLeft=e+o*s:l.swipeLeft=e+o*(l.$list.height()/l.listWidth)*s,!0===l.options.verticalSwiping&&(l.swipeLeft=e+o*s),!0!==l.options.fade&&!1!==l.options.touchMove&&(!0===l.animating?(l.swipeLeft=null,!1):void l.setCSS(l.swipeLeft))))},e.prototype.swipeStart=function(i){var e,t=this;if(t.interrupted=!0,1!==t.touchObject.fingerCount||t.slideCount<=t.options.slidesToShow)return t.touchObject={},!1;void 0!==i.originalEvent&&void 0!==i.originalEvent.touches&&(e=i.originalEvent.touches[0]),t.touchObject.startX=t.touchObject.curX=void 0!==e?e.pageX:i.clientX,t.touchObject.startY=t.touchObject.curY=void 0!==e?e.pageY:i.clientY,t.dragging=!0},e.prototype.unfilterSlides=e.prototype.slickUnfilter=function(){var i=this;null!==i.$slidesCache&&(i.unload(),i.$slideTrack.children(this.options.slide).detach(),i.$slidesCache.appendTo(i.$slideTrack),i.reinit())},e.prototype.unload=function(){var e=this;i(".slick-cloned",e.$slider).remove(),e.$dots&&e.$dots.remove(),e.$prevArrow&&e.htmlExpr.test(e.options.prevArrow)&&e.$prevArrow.remove(),e.$nextArrow&&e.htmlExpr.test(e.options.nextArrow)&&e.$nextArrow.remove(),e.$slides.removeClass("slick-slide slick-active slick-visible slick-current").attr("aria-hidden","true").css("width","")},e.prototype.unslick=function(i){var e=this;e.$slider.trigger("unslick",[e,i]),e.destroy()},e.prototype.updateArrows=function(){var i=this;Math.floor(i.options.slidesToShow/2),!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&!i.options.infinite&&(i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false"),i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false"),0===i.currentSlide?(i.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false")):i.currentSlide>=i.slideCount-i.options.slidesToShow&&!1===i.options.centerMode?(i.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")):i.currentSlide>=i.slideCount-1&&!0===i.options.centerMode&&(i.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")))},e.prototype.updateDots=function(){var i=this;null!==i.$dots&&(i.$dots.find("li").removeClass("slick-active").end(),i.$dots.find("li").eq(Math.floor(i.currentSlide/i.options.slidesToScroll)).addClass("slick-active"))},e.prototype.visibility=function(){var i=this;i.options.autoplay&&(document[i.hidden]?i.interrupted=!0:i.interrupted=!1)},i.fn.slick=function(){var i,t,o=this,s=arguments[0],n=Array.prototype.slice.call(arguments,1),r=o.length;for(i=0;i<r;i++)if("object"==typeof s||void 0===s?o[i].slick=new e(o[i],s):t=o[i].slick[s].apply(o[i].slick,n),void 0!==t)return t;return o}});
;
// Add your custom JavaScripts to this file
!/* Build scripts */
(function() {
    /*
     * Detect SVG support
     */
    function supportsSvg() {
      var div = document.createElement('div');
      div.innerHTML = '<svg/>';
      return (div.firstChild && div.firstChild.namespaceURI) == 'http://www.w3.org/2000/svg';
    }
    /*
    * Load SVG via AJAX
    */
    var $ajax = new XMLHttpRequest();
    $ajax.open('GET', '/media/medschool2018/site-assets/css/icons/som-icons.svg', true);
    //$ajax.open('GET', '/media/medschool2018/site-assets/css/icons/som-icons.svg', true);
    $ajax.onreadystatechange = loadSVGs;
    $ajax.send();
    function loadSVGs() {
      if ($ajax.readyState === 4) {
        if ($ajax.status === 200) {
          var responseContentType = $ajax.getResponseHeader("Content-Type");
          if (responseContentType.indexOf('image/svg+xml') !== -1) {
            var div = document.createElement("div");
            div.setAttribute('class', 'vcu-som-icons-stack');
            div.innerHTML = $ajax.responseText;
            document.body.insertBefore(div, document.body.childNodes[0]);
          } else {
            $('body').addClass('no-svg');
          }
        } else {
          console.log('Load SVG HTTP status is: '+$ajax.status);
        }
      }
    }
    /**
      ** Plugins
    **/
    /** Slick instances **/
    $('.hero-slider__slider').slick({
      mobileFirst: true,
      slidesToShow: 1,
      speed: 400,
      autoplay: true,
      autoplaySpeed: 5000,
      slide: '.hero-slider__slide',
      prevArrow: '.hero-slider__controls__prev',
      nextArrow: '.hero-slider__controls__next',
      appendArrows: '.slider__controls'
    });
    $('.news-slider__slick').slick({
        dots: true,
        slidesToShow: 1,
        slide: '.news-slider__slide',
        prevArrow: '.slider-control__prev.news-slider__control',
        nextArrow: '.slider-control__next.news-slider__control',
        appendArrows: '.news-slider__controls',
        speed: 400,
        mobileFirst: true,
        responsive: [
            {
                breakpoint: 1040,
                settings: {
                    centerMode: true,
                    centerPadding: '2%',
                    slidesToShow:1
                }
            },
            {
                breakpoint: 1140,
                settings: {
                    centerMode: true,
                    centerPadding: '3%',
                    slidesToShow:1
                }
            },
            {
                breakpoint: 1280,
                settings: {
                    centerMode: true,
                    centerPadding: '4%',
                    slidesToShow:1
                }
            },
            {
                breakpoint: 1540,
                settings: {
                    centerMode: true,
                    centerPadding: '6%',
                    slidesToShow:1
                }
            },
            {
                breakpoint: 1640,
                settings: {
                    centerMode: true,
                    centerPadding: '10%',
                    slidesToShow:1
                }
            },
            {
                breakpoint: 1780,
                settings: {
                    centerMode: true,
                    centerPadding: '12%',
                    slidesToShow:1
                }
            }
        ]
    });
    //Video gallery
  $('.gallery-feature__slider').each(function(idx, el) {
    var $this = $(el);
        $this.slick({
        mobileFirst: true,
        lazyLoad: 'ondemand',
        slidesToShow: 1,
        speed: 400,
        autoplay: true,
        autoplaySpeed: 5000,
        slide: '.video-slider-card',
        prevArrow: '.video-gallery-feature .slider-control.slider-control__prev',
        nextArrow: '.video-gallery-feature .slider-control.slider-control__next',
        responsive: [
            {
                breakpoint: 787,
                settings: {
                    slidesToShow: 1,
                    centerMode: true,
                    centerPadding: '30.9015%',
                    breakpoint: 1024
                }
            },
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 1,
                    centerMode: true,
                    centerPadding: '30.9015%',
                    breakpoint: 1024
                }
            }
        ]
    });
    });
$('.photo-gallery-feature__slider').each(function(idx, el) {
    var $this = $(el);
        $this.slick({
        mobileFirst: true,
        lazyLoad: 'ondemand',
        slidesToShow: 1,
        speed: 400,
        autoplay: true,
        autoplaySpeed: 5000,
        slide: '.photo-slider-card',
		appendArrows: $this.find('.photo-slider__controls.column'),
        prevArrow: '<button class="slider-control slider-control__prev "><span class="icon icon--svg has-icon-white"><svg class="svg-icon"><use xlink:href="#prev_arrow"></use></svg></span></button>',
        nextArrow: '<button class="slider-control slider-control__next "><span class="icon icon--svg has-icon-white"><svg class="svg-icon"><use xlink:href="#next_arrow"></use></svg></span></button>',
        responsive: [
            {
                breakpoint: 787,
                settings: {
                    slidesToShow: 1,
                    centerMode: true,
                    centerPadding: '30.9015%',
                    breakpoint: 1024
                }
            },
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 1,
                    centerMode: true,
                    centerPadding: '30.9015%',
                    breakpoint: 1024
                }
            }
        ]
    });
    });
    $('.discovery-slider__slider').each(function(idx, el) {
        var $this = $(el);
        $this.slick({
            mobileFirst: true,
            slidesToShow: 1,
	        speed: 400,
    	    autoplay: true,
    	    autoplaySpeed: 5000,
            slide: '.discovery-slider__slide',
            appendArrows: $this.find('.discovery-slider__controls'),
            prevArrow: '<button class="slider-control slider-control__prev discovery-slider__control discovery-slider__controls__prev "><span class="icon icon--svg has-icon-white"><svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#prev_arrow"></use></svg></span></button>',
            nextArrow: '<button class="slider-control slider-control__next discovery-slider__control discovery-slider__controls__next " ><span class="icon icon--svg has-icon-white"><svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#next_arrow"></use></svg></span></button>',
            responsive: [
                {
                    breakpoint: 787,
                    settings: {
                        slidesToShow: 2
                    }
                },
                {
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 1200,
                    settings: {
                        slidesToShow: 4,
                    }
                }
            ]
        });
    });
    $('.video-slider-card.slick-slide').not('.slick-current').on('click', function(event) {
        event.preventDefault();
        $('.gallery-feature__slider').slick('slickGoTo', parseInt($(this).data('slick-index')));
    });
    $('.som-lightbox__slider').slick({
        mobileFirst: true,
        slidesToShow: 1,
        slide: '.som-lightbox__slider .som-lightbox-item',
        prevArrow: '.som-lightbox__slider .slider-control.slider-control__prev',
        nextArrow: '.som-lightbox__slider .slider-control.slider-control__prev',
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 1,
                    centerMode: true,
                    centerPadding: '14.58881%',
                    breakpoint: 1024
                }
            }
        ]
    });
    $('.discovery-feature  .discovery-feature__slider').slick({
        mobileFirst: true,
        slide: '.discovery-feature__slider .discovery-feature__slide',
        prevArrow: '.discovery-feature__slider__controls .slider-control__prev',
        nextArrow: '.discovery-feature__slider__controls .slider-control__next',
        appendArrows: '.discovery-feature__slider__controls',
        slidesToShow: 1,
        speed: 400,
        autoplay: true,
        autoplaySpeed: 5000
    });

     /*!
     * jQuery Match Height https://github.com/liabru/jquery-match-height
     */

     var alwaysMatchHeightArray = [
         '.card--flat.featured-programs-card .card-heading'
     ];
     var matchHeightArray =
         [

             '.hero-body-quicklinks-container > .hero-body > .container, .hero-body-quicklinks-container .hero-quicklinks > .container',
             '.hero-body__text',
             '.hero-body__text > p',
             '.card--flat.featured-programs-card .card-heading',
             /*'section .card--flat .card-content',*/
             '.card-columns > .column',
             '.discovery-slider .discovery-slider__slide',
             /*'.card--flat'*/
         ];
           
  	//if mobile browser then remove classes from matchHeightArray
    //if safari browser remove classes completely
if(!is_safari){
  matchHeightArray.push('section .card--flat .card-content');
  matchHeightArray.push('.card--flat');
} else {
  $('.heading-only-card__content').height('20%');
  $('.slick-slide').height('70%');
}
if (!is_safari && $(window).width() > 600) {
  matchHeightArray.push('section .card--flat .card-content');
  matchHeightArray.push('.card--flat');
}

     if ($(window).outerWidth() > 768) {
         matchHeightArray.forEach(function($this, idx, arr) {
             $($this).matchHeight({byRow: true});
         });
     } /*else { //added by nhellenbrand on 4/8/19 to include items < 768
		matchHeightArray.forEach(function($this, idx, arr) {
                 $($this).matchHeight();
             });
     }*/
     $(window).on('resize', function() {
         if ($(window).outerWidth() >=767) {
             matchHeightArray.forEach(function($this, idx, arr) {
                 $($this).matchHeight();
             });
         } else {
             matchHeightArray.forEach(function($this, idx, arr) {
                 $($this).css('height', 'auto');
             });
         }
     });


     function jMatchHeight() {
        $('.som-profile-section .cards-columns .column').each(function(){
            $(this).find('.profile_heading').css('height', 'auto');
        });
        var largest = 0;
        $('.som-profile-section .cards-columns .column').each(function(){
            if ($(this).find('.profile_heading').outerHeight() > largest) {
                largest = $(this).find('.profile_heading').outerHeight();
            }
        });
        $('.som-profile-section .cards-columns .column').each(function(){
            $(this).find('.profile_heading').css('height', largest+'px');
        });
     }
     $( document ).ready(function() {
         jMatchHeight();
     });
     $(window).resize(jMatchHeight);
    /**
      ** Custom Scripts
    **/
    /**
     ** SoM Custom lightbox - Michael Mason
    **/
    if ($('.som-lb-item').length > 0) {
        $('.som-lb-item').on('click', showSoMLightbox);
        $('.som-lightbox__close').on('click', function (event) {
            event.preventDefault();
            $('.som-lightbox').removeClass('is-visible');
            $('body').removeClass('has-lightbox-active');
        });
    }
    function showSoMLightbox(event) {
        event.preventDefault();
        var galleries = {};
        var galleryItems = [];
        var galleryTitle = "";
        var $lightBox = $('.som-lightbox');
            var $thisItem = $(this);

            if ($thisItem.data('lightboxGallery') !== "" && $thisItem.data('lightboxGallery') !== undefined) {
                var galleryTitle = $thisItem.data('lightbox-gallery');
                var galleryItems = $('[data-lightbox-gallery="'+ galleryTitle + '"]');
            } else {
                var thisTitle = $thisItem.data('lightbox-title');
                var $lightBoxTitleH2 = $('<h2 />').append(thisTitle);
                var $lightBoxTitle = $('<div class="som-lightbox__title" />').append($lightBoxTitleH2);
                var thisCaption = $thisItem.data('lightbox-caption');
                var $lightBoxCaptionP = $('<p />').text(thisCaption);
                var $lightboxCaption = $('<div class="som-lightbox__caption" />').append($lightBoxCaptionP);
                var thisUrl = $thisItem.data('lightbox-url');
                var thisMediaType = $thisItem.data('lightbox-media-type');
                var $lightBoxMediaContents;
                if (thisMediaType === 'img') {
                    $lightBoxMediaContents = $('<img />');
                    $lightBoxMediaContents.attr('src', thisUrl);
                    $lightBoxMediaContents.attr('attr', thisTitle);
                } else if (thisMediaType === 'video') {
                    $lightBoxMediaContents = $('<video />');
                    $lightBoxMediaContents.attr('height', '315');
                    $lightBoxMediaContents.attr('width', '560');
                    $lightBoxMediaContents.attr('src', thisUrl);
                } else if (thisMediaType === 'youtube-video') {
                    $lightBoxMediaContents = $('<iframe />');
                    $lightBoxMediaContents.attr('height', '315');
                    $lightBoxMediaContents.attr('width', '560');
                    $lightBoxMediaContents.attr('src', 'https://www.youtube.com/embed/'+$thisItem.data('lightbox-youtubeid')+'?autoplay=1rel=0');
                  	$lightBoxMediaContents.attr('allowfullscreen', true);
                } else if (thisMediaType === 'vimeo-video') {
                    $lightBoxMediaContents = $('<iframe />');
                    $lightBoxMediaContents.attr('height', '268');
                    $lightBoxMediaContents.attr('width', '640');
                    $lightBoxMediaContents.attr('src', 'https://player.vimeo.com/video/'+$thisItem.data('lightbox-vimeoid')+'?autoplay=1rel=0');
                }

                var $lightBoxMedia = $('<div class="som-lightbox__media" />');
                if (thisMediaType === 'img') {
                  $lightBoxMedia.addClass('image is-16by9');
                } else if (thisMediaType === 'youtube-video') {
                  $lightBoxMedia.addClass('video is-16by9');
                } else if (thisMediaType === 'vimeo-video') {
                  $lightBoxMedia.addClass('video is-2by1');
                }

                $lightBoxMedia.append($lightBoxMediaContents);
                var $lightBoxItem = $('<div class="som-lightbox-item" />');
                $lightBoxItem.append($lightBoxTitle).append($lightBoxMedia).append($lightboxCaption);

                $lightBox.find('.som-lightbox__player').empty().append($lightBoxItem);
                $('body').addClass('has-lightbox-active');
                $lightBox.addClass('is-visible');
            }
    }

    /*Reset video on Close - JC[T4]*/
    $('.som-lightbox span.icon-text').on('click', function() {
      $('.som-lightbox__player iframe').attr('src','');
  	  $('.som-lightbox__player').empty();
    });

    $(document).keyup(function(e) {
      if (e.keyCode == 27 && $('body').hasClass('has-lightbox-active')) {
        $('.som-lightbox__close').trigger('click');
      }
    });
    $('.som-lightbox').on('click', function(event){
      var target = $(event.target);
      if(target.is('.som-lightbox') || target.is('.som-lightbox-column')) {
        $('.som-lightbox__close').trigger('click');
      }
    });

    /* Hero video load and resize*/
  /* For Mobile  */
  	$(function() {
       if ($(window).width() <= 600) {
		   $('div.hero-video video').attr('src', '');
       }
});

    function heroVideo() {
      $('.hero-video').each(function() {
        var ratio = 16/9;
        var heroContainer = $(this).closest('.hero--video');
        var video = $(this);
        var videoElement = $(this).children('video');
        if (heroContainer.hasClass('is-loaded') === false) {
          if ((videoElement[0].canPlayType('video/mp4') == 'maybe' || videoElement[0].canPlayType('video/mp4') == 'probably') && videoElement[0].canPlayType('video/mp4') != 'no') {
            videoElement[0].addEventListener('error', function(error) {
              videoElement.css('display', 'none');
              heroContainer.css({backgroundImage: 'url('+heroContainer.data('videoBackground')+')'});
            }, true);
            heroContainer.addClass('is-loaded');
          } else {
            videoElement.css('display', 'none');
            heroContainer.css({backgroundImage: 'url('+heroContainer.data('videoBackground')+')'});
          }
          video.css('width', '');
          var heroHeight = heroContainer.outerHeight();
          var videoHeight = video.outerHeight();
          if ( videoHeight < heroHeight ) {
            var newWidth = heroHeight * ratio;
            video.css({width: newWidth + 'px'});
          }
        }
      });
    }
    heroVideo();
    $(window).on('resize', function() {
      heroVideo();
    });

    //Toggle landing page navigation
    var $landingNav       = $('.landing-page-navigation');
    var $landingNavToggle = $('.landing-page-nav__toggle');
    $landingNavToggle.on('click', function(event) {
        event.preventDefault();
        $('.landing-page-nav__body-wrap').slideToggle(240, function() {
            $landingNav.toggleClass('is-active');
        });
    }).off('click');
    var $audienceNav      = $('.audience-navigation');
    var $audienceNavToggle= $('.audience-nav__toggle');
    $audienceNavToggle.on('click', function(event) {
        event.preventDefault();
        $('.audience-navigation__body-wrap').slideToggle(240, function() {
            $landingNav.toggleClass('is-active');
        });
    });
    /* Main, secondary navigation icons */
    //The main nav icon in mobile
    //Mobile nav toggle links
    var $mobileNavToggles = [$('.main-nav-toggle__mobile .navbar-link'), $('.secondary-nav-toggle--mobile > .navbar-link'),  $('.site-search-toggle--mobile > .navbar-link')];
    //Mobile nav dropdowns
    var $mobileNavDropdowns = [$('.main-navigation__menu'), $('.secondary-nav--mobile__menu'),  $('.site-search-form')];
    //Clears all visible navs other than this one, removes .is-active from the link and from the dropdown - called when a toggle link is clicked.
    function clearActiveNavs($this) {
        $mobileNavToggles.forEach(function(el, idx) {
            if ($(el).hasClass('is-active') && $(el).is($this) === false) {
                $(el).removeClass('is-active');
                ($($mobileNavDropdowns[idx]).hasClass('is-active')) ? $($mobileNavDropdowns[idx]).removeClass('is-active') : false;
            }
        })
    }
    //Nav toggle links
    $('.main-nav-toggle__mobile .navbar-link').on('mousedown focus', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearActiveNavs($(this));
        $(this).toggleClass('is-active');
        $('.main-navigation__menu').toggleClass('is-active');
        console.log($('.main-navigation__menu.is-active .navbar-link.navbar-link--main').eq(0).focus());
        $('.main-navigation__menu.is-active .navbar-link.navbar-link--main').eq(0).focus();
    });
    //The secondary nav icon in mobile
    $('.secondary-nav-toggle--mobile > .navbar-link').on('mousedown focus', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearActiveNavs($(this));
        $(this).toggleClass('is-active');
        $('.secondary-nav--mobile__menu').toggleClass('is-active');
    });
    //Site search mobile, desktop
    $('.site-search-toggle--mobile > .navbar-link').on('mousedown focus', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearActiveNavs($(this));
        $(this).toggleClass('is-active');
        $('.site-search-form').toggleClass('is-active');
        $('.site-search-form #searchquery').focus();
    });
    $('.main-navigation__search-toggle .navbar-link').on('mousedown focus', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        $(this).toggleClass('is-active');
        $('.site-search-form').toggleClass('is-active');
        //console.log($('#searchquery'));
        $('.site-search-form #searchquery').focus();
    });
    //Secondary nav mobile dropdowns
    $('.secondary-nav--mobile__link.has-dropdown').on('mousedown focus', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        $('.secondary-nav--mobile__menu .navbar-dropdown.is-active').not( $(this).siblings('.navbar-dropdown')).removeClass('is-active');
        $('.secondary-nav--mobile__link.has-dropdown.is-active').not($(this)).removeClass('is-active');
        $(this).toggleClass('is-active');
        $(this).siblings('.navbar-dropdown').toggleClass('is-active');
        $(this).siblings('.navbar-dropdown').children('a').eq(0).focus();
    });
    $('.site-search-form .site-search-form__close').on('click', function(event) {
        event.preventDefault();
        $('.site-search-form.is-active').removeClass('is-active');
    });
    //Main nav dropdowns mobile handler
    function addMainNavHandlers() {
        $('.main-navigation__menu .main-navigation__item.has-dropdown .navbar-link--main').off('mousedown focus focusout');
        if ($(window).outerWidth() < 1024) {
            $('.main-navigation__menu .main-navigation__item.has-dropdown .navbar-link--main').each(function(idx) {
                 $(this).on('mousedown focus', function(event) {
                     event.preventDefault();
                     event.stopImmediatePropagation();
                     $('.main-navigation__menu .navbar-dropdown.is-active').not($(this).siblings('.navbar-dropdown')).removeClass('is-active');
                     $('.navbar-link--main.is-active').not($(this)).removeClass('is-active');
                     ($(this).hasClass('is-active')) ? $(this).removeClass('is-active') : $(this).addClass('is-active');
                     ($(this).siblings('.navbar-dropdown').hasClass('is-active')) ? $(this).siblings('.navbar-dropdown').removeClass('is-active') : $(this).siblings('.navbar-dropdown').addClass('is-active');
                });
            });
        } else {
          $('.navbar-link.navbar-link--main').on('focus', function() {
            var $dropdown = $(this).next('.navbar-dropdown');
            var $lastLink = $dropdown.find('a');
            $dropdown.addClass('is-active');
            $(this).addClass('is-active');
            $lastLink = $lastLink.eq($lastLink.length - 1);
            var $this = $(this);
            $lastLink.on('focusout', function() {
              $dropdown.removeClass('is-active');
              $this.removeClass('is-active');
            });
          });
          $('.navbar-item.main-navigation__item').hover(function() {
            $('.navbar-dropdown.is-active').removeClass('is-active');
            console.log($('.navbar-dropdown.is-active'));
            $('.navbar-link.navbar-link--main.is-active').removeClass('is-active');
            var $dropdown = $(this).children('.navbar-dropdown');
            $dropdown.addClass('is-active');
            $(this).children('.navbar-link--main').addClass('is-active');
          }, function() {
            var $dropdown = $(this).children('.navbar-dropdown');
            $dropdown.removeClass('is-active');
            $(this).children('.navbar-link--main').removeClass('is-active');
          });
        }
     }
     addMainNavHandlers();
     $(window).on('resize', addMainNavHandlers);
    /* Add classes to single column dropdowns in Main nav */
    var $navItems = $('.main-navigation__item'), navItemsCount = $('.main-navigation__item').length;
    var isOdd = false;
    var middleNumber = Math.floor(navItemsCount/2);
    $navItems.each(function(idx, el) {
        $thisNavItem = $(el);
        if (navItemsCount % 2 === 0) {
            //even number
            if (idx === middleNumber - 1 || idx === middleNumber) {
                $thisNavItem.addClass('main-navigation__item--middle');
            } else if (idx < middleNumber -1) {
                $thisNavItem.addClass('main-navigation__item--left');
            } else {
                $thisNavItem.addClass('main-navigation__item--right');
            }
        } else {
            //odd number
            if (idx === middleNumber) {
                $thisNavItem.addClass('main-navigation__item--middle');
            } else if (idx < middleNumber) {
                $thisNavItem.addClass('main-navigation__item--left');
            } else {
                $thisNavItem.addClass('main-navigation__item--right');
            }
        }
    });
    $('.sidebar-nav li').each(function(idx, ele) {
      var $thisLi = $(ele);
      if ($thisLi.children('ul').length > 0) {
        $thisLi.addClass('has-dropdown');
        $thisLi.children('a').after('<a href="javascript:void(0)" class="icon icon--svg sidebar-nav-toggle__icons" title="View next level links"><svg class="show-more-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#plus_icon"></use></svg><svg class="show-less-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#minus_icon"></use></svg></a> ');
      }
    });
     /* Show/hide inner nav in smaller resolutions max-width 991px */
    function toggleSidebarNav() {
        var $thisHeading = $(this).parent('.sidebar-nav-toggle') ;
        if (!$thisHeading.hasClass('is-active')) {
            $thisHeading.siblings('.sidebar-nav').slideDown(200, function() {
                $thisHeading.addClass('is-active');
            });
        } else {
            $thisHeading.siblings('.sidebar-nav').slideUp(200, function() {
                $thisHeading.removeClass('is-active');
            });
        }
    }
    if ($(window).outerWidth() > 1024) {
         $('.sidebar-nav-toggle > a').off('mousedown focus', toggleSidebarNav);
    } else {
        $('.sidebar-nav-toggle > a').on('mousedown focus', toggleSidebarNav);
    }

    $(window).on('resize', function() {
        if ($(window).outerWidth() > 1024) {
            $('.sidebar-nav:hidden').fadeIn(180);
            $('.sidebar-nav-toggle > a').off('mousedown focus', toggleSidebarNav);
        } else {
            $('.sidebar-nav-toggle > a').on('mousedown focus', toggleSidebarNav);
        }
    });
    $(document).on('mousedown focus', '.sidebar-nav li.has-dropdown > .sidebar-nav-toggle__icons', function(event) {
        event.preventDefault();
        $this = $(this);
        $thisLi = $this.parent('li');
        if ($thisLi.hasClass('is-active')) {
            $this.next('ul').slideUp(200, function() {
                $thisLi.removeClass('is-active');
            });
        } else {
            $this.next('ul').slideDown(200, function() {
                $thisLi.addClass('is-active');
            });
        }
    });

     /** By the numbers count up **/
    var countUpIsDone = false;
    if ($('.by-the-numbers-feature').length > 0) {
        $('.by-the-numbers-feature').each(function(idx, el) {
            var $thisFeature = $(el);
            $(window).on('scroll', function() {
                if ($(el).attr('counted-up') !== 'true') {
                    var $byTheNumbersCols = $thisFeature.find('.by-the-numbers__columns');
                    var byTheNumbersTop = $byTheNumbersCols.offset().top;
                    var byTheNumbersBottom = byTheNumbersTop + $byTheNumbersCols.outerHeight();
                    var viewportTop = $(window).scrollTop();
                    var viewportBottom = viewportTop + $(window).height();
                    if (byTheNumbersBottom > viewportTop && byTheNumbersTop < viewportBottom) {
                        byTheNumbersCountUp($byTheNumbersCols);

                    }
                }
            });
        });
    }
    function byTheNumbersCountUp($numbersCols) {
        $numbersCols.find('.by-the-numbers-card').each(function(idx, el) {
            var $thisCountUp = $(el).find('.by-the-numbers__count-up');
            var targetNumber = parseFloat($thisCountUp.data('count-up-to'));
            var numb = parseFloat($thisCountUp.html());
            function incrementNumber() {
              if (targetNumber < 200) {
                //numb++; nhellenbrand on 3/12/19 to Fix the inaccurate numbers
                if (numb < targetNumber) {
                    numb++;
                    setTimeout(function() {
                        $thisCountUp.text(numb);
                        incrementNumber();
//                    }, 3000/targetNumber);
                    }, targetNumber/3000);
                } else {
                  $('span.by-the-numbers__count-up').each(function() {
	                  var targetNumber2 = $(this).data('count-up-to');
	                  $(this).text(targetNumber2);
	                }, 7000);
                    $(this).closest('.by-the-numbers-feature').attr('counted-up', 'true');
                    return;
                }
              } else {
              	$('span.by-the-numbers__count-up').each(function() {
                  var targetNumber2 = $(this).data('count-up-to');
                  $(this).text(targetNumber2);
                }, 7000);
              }

            }
            setTimeout(function() {
                incrementNumber();
            }, 500);
        }) ;
    }

    //Diversity .active class toggle
    $('.feature-section.feature-section--fixed').find('.feature-section--fixed__toggle').on('click', function(event) {
        event.preventDefault();
        $(this).closest('.feature-section.feature-section--fixed').toggleClass('is-active');
    });
    $('.feature-section.feature-section--fixed').find('.feature-section--fixed__hide').on('click', function(event) {
        event.preventDefault();
        if ($(this).closest('.feature-section.feature-section--fixed').hasClass('is-hidden') === false) {
           $(this).closest('.feature-section.feature-section--fixed').fadeOut(300, function() {
            $(this).addClass('is-hidden');
           });
        }
    });
    /* Landing and inner page nav scrolls */
    $('.inner-page-nav__item > a, .landing-page-navigation__link').on('click', function(event) {
        event.preventDefault();
        var $this = $(this);
        var thisTarget = $($this.attr('href')).offset().top;
        $('html, body').animate({scrollTop: thisTarget}, 300);
        return false;
    });

    //.feature-section
    $('.hero-foot a.svg-icon-wrap').on('click', function(eve) {
        eve.preventDefault();
        var $this = $(this);
        try {

           if ($($this.attr('href')).offset() != undefined || $($this.attr('href')).offset() != null) {
                var thisTarget = $($this.attr('href')).offset().top;
                $('html, body').animate({scrollTop: thisTarget}, 300);
           } else {
                var thisTarget = $($this.closest('.hero').next('.section')).offset().top;
                $('html, body').animate({scrollTop: thisTarget}, 300);
           }

        } catch (err) {
            console.error('Hero scroll function error: '+ err);
            console.info('Stack: '+ err.stack);
        }
        return false;
    });
    /* Program info cards */

    var $programInfoCards = $('.program-info-card'), $programInfoCardButtons = $('.program-info-card__button'), $programInfoCardCards = $('.program-info-card__card');
    $('.program-info-card__card:odd').addClass('program-info-card__card--right');
    $programInfoCardButtons.on('click', function(event) {
           event.preventDefault();
           var $this = $(this);
           var target = $this.data('program');
           if ($this.hasClass('is-visible')) {
               $this.removeClass('is-visible');
               $programInfoCardCards.each(function(idx, el) {
                    if ($(this).hasClass('is-visible')) {
                        $(this).removeClass('is-visible')
                    }
               });
           } else {
               $programInfoCardCards.removeClass('is-visible');
               $programInfoCardCards.each(function(idx, el) {

                    if ($(this).data('program') === target) {
                        $(this).addClass('is-visible')
                    }
               });
               $this.addClass('is-visible');
           }
    });
    if ($(window).outerWidth() >= 768 && $('.programs-block').length > 0 && $('.programs-block').hasClass('programs-block--cloned') !== true ) {
        var $programInfoCardsEven = $('.program-info-card__card--column:even');
        var $programInfoCardsOdd = $('.program-info-card:odd');
        $('.program-info-card:odd').each(function(idx, el) {
            var $thisCard = $(el);
            $thisCard.after($programInfoCardsEven[idx]);
        });
        $('.programs-block').addClass('programs-block--cloned');
    }
    $(window).on('resize', function() {
        if ($(window).outerWidth() >= 768 && $('.programs-block').length > 0 && $('.programs-block').hasClass('programs-block--cloned') !== true) {
            var $programInfoCardsEven = $('.program-info-card__card--column:even');
            var $programInfoCardsOdd = $('.program-info-card:odd');
            $('.program-info-card:odd').each(function(idx, el) {
                var $thisCard = $(el);
                $thisCard.after($programInfoCardsEven[idx]);
            });
            $('.programs-block').addClass('programs-block--cloned');
        } else {

        }
    });

    /**
      * VCU Plugin Accordion panel
      * http://katmai.staging.vcu.edu/plugins/accordion-panel/
    **/
    $('.plugin-accordion-heading').on('click', function(event) {
        event.preventDefault();
        var $thisPanel = $(this).closest('.plugin-accordion-panel ');
        if ($thisPanel.hasClass('expand')) {
            $thisPanel.removeClass('expand');
        } else {
            $('.plugin-accordion-panel.expand').removeClass('expand');
            $thisPanel.addClass('expand');
        }
    });

    /* Skip links target */
    $('.hero, .section:not(.main-site-header, footer)').eq(0).attr('id', 'content-start');

    /* Diversity fixed element */
    function fixFixedFeature(featureRightValue) {
        var $fixedFeature = $('.feature-section.feature-section--fixed');
        var featureLeftPadding = parseInt($fixedFeature.find('.feature-section--fixed__text-container').css('paddingLeft'));
		var featureRightValue;
        if (featureRightValue === undefined) {
            if ($fixedFeature.css('position') === 'absolute') {
				console.log("$fixedFeature.css('position') Is absolute");
                featureRightValue = - ($fixedFeature.outerWidth() - (featureLeftPadding / 2) - 8) / ($('.body-wrap').outerWidth()) * 100;
                var offsetTop = $fixedFeature.offset().top;

            } else {
				console.log("$fixedFeature.css('position') Is not absolute");
                featureRightValue = - ((($fixedFeature.outerWidth() - (featureLeftPadding / 2) - 8) / $('.body-wrap')) * 100) + (($('.body-wrap').offset().left / $(document).outerWidth()) * 100);

            }
            /*$fixedFeature.css({right: featureRightValue + '%'});*/
        } else {
           /* $fixedFeature.css({right: featureRightValue + '%'});  */
        }

    }
    if ($('.feature-section.feature-section--fixed').length > 0) {
        fixFixedFeature();
        $(window).on('resize', function() {
                fixFixedFeature();
				console.log('resized triggered');
        });
    }
    //Responsive videos in general content
    $('.main-content .general-content iframe').each(function(idx, ele) {
        var $this = $(ele);
        if ($this.parents('.fulltext-video').length < 1) {
            $this.wrap('<div class="fulltext-video video is-16by9"></div>');
        }
    });

  //VCU Scripts imported from old build
  /* Search related */
  function checkQuery() {
     var queryFld = document.keyword.query;
     if (queryFld.value == "") {
       alert ("Please enter a term to search");
       queryFld.focus();
       return(false);
       }
     return(true);
     }

  function checkName() {
     var nameFld = document.ccso.NAME;
     if (nameFld.value == "") {
       alert ("Please enter a name");
       nameFld.focus();
       return(false);
       }
     return(true);
     }

  function convertString( temp ) {
     var newString = "";
     var i=0;
     for( i=0; i < temp.length; i++ ) {
       if( temp.charAt(i) != " " ) {
         newString += temp.charAt(i);
         }
       else {
         newString += "+";
         }
       }
     return newString;
  }
  $('#som-site-earch-form').on('submit', function(event) {
    event.preventDefault();
    if( document.keyword.searchnav[0].checked ) {
      if( checkQuery() ) {
      var header = "https://search.vcu.edu/s/search.html?collection=vcu-meta";
      //var options = "&access=p&proxystylesheet=default_frontend";
      var searchVal = "&query=" + convertString(document.keyword.query.value);
      //eval( "location = " + "\"" + header + searchVal + options + "\"");
      window.location.href = header + searchVal;
      }
    }

          //people
    if( document.keyword.searchnav[1].checked ) {
       if( checkQuery() ) {
         var header = "http://phonebook.vcu.edu?";
         options = "TYPE=All";
         searchVal = "&NAME=" + convertString(document.keyword.query.value);
         window.location.href = header + options + searchVal;
      }
    }
    //Medschool via Google
    if( document.keyword.searchnav[2].checked ) {
      if( checkQuery() ) {
        var header = "https://search.vcu.edu/s/search.html?collection=vcu-meta&clive=vcu-medicine";
        //var options = "&access=p&site=somweb&proxystylesheet=default_frontend";
        var searchVal = "&query=" + convertString(document.keyword.query.value);
        window.location.href = header + searchVal;
      }
    }
  });
  $('.secondary-nav__navbar .navbar-item.has-dropdown > a').on('focus', function() {

  });
  //* Main and secondary navigation
  $('.secondary-nav__navbar .navbar-item.has-dropdown > a').on('focus', function() {
    var $dropdown = $(this).next('.navbar-dropdown');
    console.log($dropdown);
    var $lastLink = $dropdown.find('a');
    $dropdown.addClass('is-active');
    $lastLink = $lastLink.eq($lastLink.length - 1);
    $lastLink.on('focusout', function() {
      $dropdown.removeClass('is-active');
    });
  })
 /* $('.navbar-link.navbar-link--main').on('focus', function() {
    var $dropdown = $(this).next('.navbar-dropdown');
    var $lastLink = $dropdown.find('a');
    $dropdown.addClass('is-active');
    $lastLink = $lastLink.eq($lastLink.length - 1);
    $lastLink.on('focusout', function() {
      $dropdown.removeClass('is-active');
    });


  });*/

  /*T4 Implementation Updates*/
/*Secondary Navigation Add classes for desktop and Mobile*/
$('.secondary-navigation .navbar-end a').addClass('navbar-item');
$('.secondary-nav--mobile__menu .navbar-end a').addClass('navbar-link').addClass('secondary-nav--mobile__link');


/*Search Bar Accessibility updates*/
 $( ".site-search-form__close" ).click(function() {
    $(".main-navigation__search-toggle a.navbar-link").removeClass("is-active");
  });
  $(document).ready(function(){
    $( ".main-navigation__search-toggle" ).mouseup(function() {
      $( "#searchquery" ).focus();
    });
  });

/*If Internet explorer, fix Visual Graphic*/
  if (/MSIE (\d+\.\d+);/.test(navigator.userAgent) || navigator.userAgent.indexOf("Trident/") > -1 ){
    $('.feature-section--vision-graphic .columns').removeClass('pull-right');
    $('.card-image figure.profile img').css("display","none");
  }

/*Safari Search Box update*/
if ( /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
    $('.navbar-link.is-vision-angle--right').addClass('safari_only');
}


$(function() {
	$('.cards-columns').each(function() {
	  var columnLength = $(this).find('.column').length;
	  if (columnLength === 1) {
	      $(this).find('.column').addClass('one-cards');
	      console.log(columnLength);
	  }
      if (columnLength === 2) {
	      $(this).find('.column').addClass('two-cards');
	      console.log(columnLength);
	  }
	  if (columnLength === 3) {
	      $(this).find('.column').addClass('three-cards');
	      console.log(columnLength);
	  }
	  if (columnLength === 4) {
	      $(this).find('.column').addClass('four-cards');
	      console.log(columnLength);
	  }
	  $(window).trigger('resize');
	});
});

$('.landing-page-navigation__body a').on('click', function(event) {
	if (($(this).attr('href')[0] == "/") && ($(this).attr('href').split('#').length > 1)) {
		var pathName = window.location.pathname;
		var str = $('.landing-page-navigation__body a').attr('href');
		var hrefHash = str.split('#')[0];
	    if (pathName === hrefHash) {

		        event.preventDefault();
		        var $this = $(this);
				var x = $this.attr('href');
				x = x.substring(x.indexOf('#') + 1);
				console.log(x);
		        var thisTarget = $('[id="' + x + '"]');
		        thisTarget = $(thisTarget).offset().top;
		        $('html, body').animate({scrollTop: thisTarget}, 300);
		        return false;

	    }
	}
 });

 // Updated by nhellenbrand on 3/7/19 for activating accordions when they are referenced
 /* $('.inner-page-nav ul a').on('click', function(event) {
    if (($(this).attr('href').split('#').length > 1)) {
      var pathName = window.location.pathname;
      var str = $('.inner-page-nav ul a').attr('href');
      var hrefHash = str.split('#')[0];
  
      event.preventDefault();
      var $this = $(this);
      var x = $this.attr('href');
      var y = x.split("#")[1].substring(5);
      console.log(y);
      x = x.substring(x.indexOf('#') + 1);
      console.log(x);
  
      var thisTarget = $('[id="' + x + '"]');
      if (thisTarget.length) {
        thisTarget = $(thisTarget).offset().top;
        $('html, body').animate({scrollTop: thisTarget}, 300);
        $('div.accordion-' + y).trigger("click");
      } else {
        console.log('pathName: '+pathName);
      $('div.accordion-' + y).trigger("click");
    }
      return false;
    }
  });*/

$('.featured-programs .featured-programs__outer-columns .columns').each(function() {
    var columnLength = $(this).find('.column').length;
    if (columnLength === 2) {
        $(this).find('.column').addClass('two-cols');
        console.log(columnLength);
    }
    if (columnLength === 3) {
        $(this).find('.column').addClass('three-cols');
        console.log(columnLength);
    }
});


$( document ).ready(function() {
  $('.som-profile-section .column .card--flat').on('click', function() {
    $('body').addClass('lightbox-open');
    var lbContent = $(this).find('.profile_lb_content').html();
    $('.som-lightbox__player').append(lbContent);
    $('.som-lightbox').addClass('is-visible');
  });
  $('.som-lightbox__close, div.background-filler').on('click', function() {
    $('.som-lightbox').removeClass('is-visible');
    $('body').removeClass('lightbox-open');
    $('.som-lightbox .profile-pop-up').remove();
    $('.som-lightbox__player').empty();
  });
});


}());

/*Custom Link Menu script*/
if ($('.left-sidebar').length) {
  var url = window.location.pathname;
  $('.left-sidebar a[href~="'+url+'"]').addClass("current");
  $('.current').parents('ul').show();
  $( document ).ready(function() {
    $('[class*="multilevel-linkul"] .current').parents('.has-dropdown').addClass('is-active');
    if ($('.current').siblings('[class*="multilevel-linkul"]').length) {
      $('.current').parent('.has-dropdown').removeClass('is-active');
    }
  });
}
$('.navbar-item.som-logo a').unbind('click');
$('.navbar-link.navbar-link--main span').click(function(event){
    var target = $(event.target);
    if (target.is('span.icon')) {
       event.stopPropagation();
       event.preventDefault();
    }
});

/* Toggle main video play or pause


var playPauseBtn = document.querySelector('.hero-video-ctrl');
var player = document.querySelector('.hero-video > video');


playPauseBtn.on('click', function() {
  if(player.paused) {
    player.play();
    playPauseBtn.textContent = '\u2161';
    document.querySelector('.hero-video-ctrl').setAttribute("aria-pressed", "false");
  } else {
    player.pause();
    playPauseBtn.textContent = '\u25B6';
    document.querySelector('.hero-video-ctrl').setAttribute("aria-pressed", "true");
  }
});*/


/* Start Toggle main video play or pause */

var playPauseBtn = document.querySelector('.hero-video-ctrl');

var player = document.querySelector('.hero-video > video ');

		if (playPauseBtn) {

			playPauseBtn.addEventListener('click', function () {

					if (player.paused) {

						player.play();

						playPauseBtn.textContent = '\u2161';

						document.querySelector('.hero-video-ctrl').setAttribute("aria-pressed", "false");

					} else {

						player.pause();

						playPauseBtn.textContent = '\u25B6';

						document.querySelector('.hero-video-ctrl').setAttribute("aria-pressed", "true");

					}

				});

		}

		/* End Toggle main video play or pause */

/* Back To Top Button */
$(function() {
  
$(window).on('scroll', function() {
  
  var bottom = $(document).height() - window.innerHeight;
  
  if ($(window).scrollTop() > 300) {
    $('div#toTop').addClass('show');
  } else if ( $(document).height() - $(window).height() - $(window).scrollTop() < 300) {
    $('div#toTop').removeClass('show');
} else {
    $('div#toTop').removeClass('show');
}
  
});

  if ($("section.has-section-nav").length) {
    $('div#toTop').on('click', function(e) {
      e.preventDefault();
      $('html, body').animate({scrollTop:$("section.has-section-nav").offset().top}, '300');
    });
  } else {
    $('div#toTop').on('click', function(e) {
      e.preventDefault();
      $('html, body').animate({scrollTop:0}, '300');
    });
  }

});



/* Possible Fix for Accordions */
$(document).ready(function (){
    $("div.plugin-accordion-heading, div.program-info-card").click(function (){
      //$('html, body').scrollTop( $(this).offset().top );
      $('html, body').animate({scrollTop: $(this).offset().top}, 300);
    });
});

/* nhellenbrand 2/21/19 VCUSOM News - empty section */
$(document).ready(function (){
	var sectionNews = $('section.news-item__related-news');
	var cardsColumns = $('section.news-item__related-news div.columns.cards-columns');
	if ( cardsColumns.html('')) {
		sectionNews.addClass('is-hidden');
		}

});


// nhellenbrand 3/11/19 to remove attributes in tables for accessability
    $(document).ready(function (){
    	$('main.main-content *').removeAttr('align cellspacing cellpadding bgcolor valign width height').children();
    });

// nhellenbrand 9/22/2020 to add new tab to news links on the RVA page
    $(document).ready(function (){
		$('#vcusom-inner-104962 h3.card__title a').attr("target", "_blank");
      
      //nhellenbrand 12/8/2020 remove faculty profile info
      if (new URLSearchParams(location.search).get('id') == 'jeaglin'){
  	$("a.faculty-email").hide();
  }
    });


//fix back totop utton on bottom of page
 $(document).ready(function (){
$("div.columns.footer__meta-links").on({
    mouseenter: function () {
        $('div#toTop').removeClass('show');
    },
    mouseleave: function () {
        $('div#toTop').addClass('show');
    }
});
 });















