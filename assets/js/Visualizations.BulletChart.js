(function (main) {
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  /* global d3 */
  /* global Utils */
  'use strict';

  var LABEL_WIDTH = 0.39;
  var INNER_HEIGHT = 0.30;
  var BUFFER = 1.15;

  function removeExponential (value) {
    return +(('' + value).split(/e/gi)[0]);
  }

  /**
   * Bullet chart constructor
   * @param HTMLNode container
   * @param Array data
   * @param Object opts Optional
   */

  var BulletChart = function (container, data, opts) {
    this.container = d3.select(container);
    opts = Utils.isObject(opts) ? opts : {};
    this.options = Utils.extend({}, BulletChart.DEFAULTS, opts);
    this.animations = false;
    this.init();
    this.events = {
      'filter': [],
      'remove-filter': []
    };
    this.filters = {};

    if (Utils.isArray(data)) {
      this.setData(data);
    }

    //hide dom filters
    var filter = container.parentNode.querySelector('.filterinfo');
    if (filter)
      filter.style.display = 'none';
  };

  BulletChart.DEFAULTS = {
    axis: {
      height: 20
    },
    axisPosition: 'top',
    width: 400,
    height: 300,
    margin: {left: 10},
    targetLabel: '',
    currentLabel: '',
    chart: {
      height: 30,
      margin: {top: 10}
    },
    label: {},
    //values represented in percentages
    thresholds: {
      lowest: 33,
      middle: 66,
      higher: 100
    },
    target: 100,
    colors: {
      lowest: '#EC5D57',
      middle: '#F5D328',
      higher: '#70BF41',
      current: '#53585f',
      target: '#FFF'
    }
  };

  /**
   * Helper method to create a key for d3's selections
   * @param Object
   * @returns String key for selection
   */
  BulletChart.key = function (data) {
    return data.key;
  };


  /**
   * Initializes the Bullet chart plugin
   *
   */
  BulletChart.prototype.init = function () {
    var svg;
    var self = this;
    var axisWrapper;
    this.options.label.width = this.options.width * LABEL_WIDTH;
    this.options.chart.inner = {
      height: this.options.chart.height  * INNER_HEIGHT
    };

    this.options.chart.target = {
      height: this.options.chart.inner.height * 2,
      width: 3
    };

    this.options.chart.inner.padding = (this.options.chart.height - this.options.chart.inner.height) / 2;
    this.options.chart.width = this.options.width * (1 - LABEL_WIDTH - 0.1);

    this.svg = this.container.append('div').attr({
      'class': 'chart-wrapper'
    }).style({
      'height': (this.options.height - this.options.axis.height) + 'px'
    }).append('svg');

    if (this.options.axisPosition === 'top')
      axisWrapper = this.container.insert('svg', 'div.chart-wrapper');
    else
      axisWrapper = this.container.append('svg');

    axisWrapper.attr({
      'class': 'axis-wrapper',
      'height': this.options.axis.height,
      'width': this.options.width
    });

    svg = this.svg.node();

    this.svg.attr({
      'class': 'bullet-charts-container',
      'width': this.options.width,
      'height': this.options.height
    });

    this.group = this.svg.append('g').attr({
      'class': 'bullet-charts-group',
      'transform': 'translate(' + this.options.margin.left + ',' + this.options.chart.margin.top + ')'
    });
    this.bullets = this.group.selectAll('g.bullet-charts');
    this.axis = axisWrapper.append('g').attr('class', 'axis');
    this.marker = this.group.append('g').attr('class', 'marker');
    this.scale = d3.scale.linear().range([0, this.options.chart.width]);
    this.setColors(this.options.colors);
    this.renderPopup();


    jQuery(svg).on('tap.bullet-chart', '.graphic', function (event) {
      self.togglePopup(d3.select(this.parentNode), event);
    }).on('tap.bullet-chart', '.label-container', function () {
      self.toggleSelect(d3.select(this.parentNode));
    });

    document.body.addEventListener('click', function (event) {
      var target = $(event.target || event.srcElement);
      if (!target.is('g.bullet-chart') && !target.parents('g.bullet-chart').length && !target.is('.ui-popup-container') && !target.parents('.ui-popup-container').length)
        self.popup.popup('close');
    });

    return this;
  };

  /**
   * Sets the colors to create the color scale
   * @param Object must contain the following keys: target, current, lowest, middle, higher
   * @returns Object
   *
   */
  BulletChart.prototype.setColors = function (colors) {
    this.colors = d3.scale.ordinal().domain(d3.keys(colors)).range(d3.values(colors));
    return this;
  };

  BulletChart.prototype.setData = function (data) {
    this.data = data;

    var scale = this.scale;
    var opts = this.options;
    var thresholds = d3.entries(opts.thresholds);
    var thresholdsVal = d3.values(opts.thresholds);
    var maxCurrent = d3.max(Utils.pluck(data, 'current'));
    var maxPast = d3.max(Utils.pluck(data, 'baseline'));
    var maxDomain = Math.max(maxCurrent, maxPast, maxPast * (opts.thresholds.higher / 100)) * BUFFER;

    var sums = 0;
    thresholds.forEach(function (threshold, index) {
      sums = d3.sum(thresholdsVal.slice(0, index)) - sums;
      threshold.step = (threshold.value - sums) / 100;
    });

    scale.domain([0, maxDomain]);
    //calculate the target, and thresholds values
    this.data.forEach(function (node, index) {
      //calculate the target;
      var target = node.baseline * (opts.target / 100);
      //get the full width corresponding to the target + BUFFER
      var maxWidth = scale(target * BUFFER);
      var bulletThreshold = [];
      //now calculate each threshold position and width
      thresholds.forEach(function (threshold, index) {
        var prevThreshold = bulletThreshold[index - 1] || {width: 0, x: 0};
        var width = scale(target * (threshold.step));
        var x = prevThreshold.width + prevThreshold.x;
        //construct the object with the rendering data
        bulletThreshold.push({
          value: threshold.value,
          key: threshold.key,
          width: width,
          x: x
        });
      });
      node.target = target;
      node.__target_x__ = removeExponential(scale(node.target));
      node.__width__ = removeExponential(scale(node.current));
      node.__thresholds__ = bulletThreshold;
      node.__y__ = ((opts.chart.height  + opts.chart.margin.top) * index);
    });
    console.log(this.data, scale.domain(), scale.range());
    return this;
  };

  BulletChart.prototype.getSVGHeight = function () {
    var opts = this.options;
    var svgHeight = ((opts.chart.margin.top + opts.chart.height) * this.data.length);
    return svgHeight;
  };

  BulletChart.prototype.getAxisPosition = function () {
    var x = this.options.label.width + this.options.margin.left;
    var y = this.options.axisPosition === 'top' ? this.options.axis.height : 1;
    return 'translate(' + x + ',' + y + ')';
  };

  BulletChart.prototype.getMarkerPosition = function () {
    return 'translate(' + (this.options.label.width) + ', 0)';
  };

  BulletChart.prototype.render = function () {
    var renderInner = Utils.proxy(this.renderInnerChart, this);
    var opts = this.options;
    var self = this;
    var axis = d3.svg.axis();
    axis.orient(opts.axisPosition);
    axis.ticks(4).scale(this.scale).tickFormat(opts.axisFormat);

    this.svg.attr('height', this.getSVGHeight());
    this.axis.attr({
      'transform': this.getAxisPosition()
    }).call(axis);
    this.marker.attr({
      'transform': this.getMarkerPosition()
    });
    this.bullets = this.bullets.data(this.data, BulletChart.key);
    this.bullets.enter().insert('g', 'g.marker').attr({
      'class': 'bullet-chart'
    });

    this.bullets.attr({
      'transform': function (data, index) {
        return 'translate(0,' + ((opts.chart.height  + opts.chart.margin.top) * index) + ')';
      }
    });
    this.bullets.exit().remove();
    this.bullets.each(function (data) {
      renderInner(d3.select(this), data);
    });
  };

  BulletChart.prototype.renderInnerChart = function (bullet, data) {
    var labelsContainer = bullet.selectAll('g.label-container').data([
      {key: 'group', value: data.key}
    ], BulletChart.key);
    var graphic = bullet.select('g.graphic');
    var opts = this.options;
    var self = this;
    if (!graphic.size()) {
      graphic = bullet.append('g').attr({
        'class': 'graphic',
        'transform': 'translate(' + opts.label.width + ', 0)'
      });
    }
    var threshold = graphic.selectAll('rect.threshold').data(data.__thresholds__);
    var current = graphic.selectAll('rect.current').data([{key: 'current', value: data.__width__}],  BulletChart.key);
    var target = graphic.selectAll('rect.target').data([{key: 'target', value: data.__target_x__}], BulletChart.key);
    //create background based on the max-width - left-label

    //create a scale to calculate the width of the thresholds based on:
    //the full width - some padding so we can show the target inside the background

    //create a the inner bar using the scale we just created

    //place the target marker using the scale
    threshold.enter().append('rect').attr({
      'class': 'threshold',
      'height': opts.chart.height,
      'width': 0,
      'x': 0
    }).style({
      'fill': function (d) {
        return self.colors(d.key);
      },
      'opacity': function () {
        return opts.opacity;
      }
    });
    current.enter().append('rect').attr({
      'class': 'current',
      'height': opts.chart.inner.height,
      'y': opts.chart.inner.padding,
      'width': 0
    }).style({
      'fill': this.colors('current')
    });

    target.enter().append('rect').attr({
      'class': 'target',
      'height': opts.chart.target.height,
      'y': (opts.chart.height / 2) - (opts.chart.target.height / 2),
      'x': 0,
      'width': opts.chart.target.width
    }).style({
      'fill': this.colors('target')
    });

    labelsContainer.enter().insert('g', 'g.graphic').attr({
      'class': 'label-container',
      'transform': function (d, index) {
        var w = opts.label.width;
        var x = (w + opts.chart.width) * index;
        return 'translate(' + x + ', 0)';
       }
    }).each(function (data) {
      self.createForeignObject(d3.select(this), data);
    });

    labelsContainer.each(function () {
      var label = d3.select(this).select('span.croptext');
      label.text(function (d) {
        return isNaN(d.value) ? d.value : opts.numberFormat(d.value);
      });
    });

    //animation
    if (self.animations) {
      target = target.transition().delay(200).duration(700);
      current = current.transition().delay(200).duration(700);
      threshold = threshold.transition().delay(200).duration(700);
    }

    current.attr('width', function (d) {
      return d.value > 0 ? d.value : 0;
    });
    target.attr('x', function (d) {
      return d.value;
    });
    threshold.attr({
      'width': function (d) {
        return d.width;
      },
      'x': function (d) {
        return d.x;
      }
    });
  };

  BulletChart.prototype.renderPopup = function () {
    this.popup = jQuery(this.container.select('div.chart-wrapper').append('div').node());
    this.popup.attr({
      'class': 'ui-content popup-detail',
      'data-arrow': 'b,l',
      'data-role': 'popup',
      'data-theme': 'a',
      'data-history': false
    });

    var popupContent = ['<ul class="details">'];
    popupContent.push('<li>');
    popupContent.push('<span class="target label">' + Utils.capitalize(this.options.targetLabel) + ':</span>');
    popupContent.push('<span class="target value"></span>');
    popupContent.push('</li>');
    popupContent.push('<li>');
    popupContent.push('<span class="current label">' + Utils.capitalize(this.options.currentLabel) + ':</span>');
    popupContent.push('<span class="current value"></span>');
    popupContent.push('</li>');
    popupContent.push('<li>');
    popupContent.push('<span class="percentage value"></span>');
    popupContent.push('<span class="percentage label">of the Target ' + Utils.capitalize(this.options.targetLabel) + '</span>');
    popupContent.push('</li>');
    popupContent.push('</ul>');

    this.popup.html(popupContent.join(''));
    this.popup.popup();
    return this;
  };

  BulletChart.prototype.createForeignObject = function (container, data) {
    var foreign = container.append('foreignObject').attr({
      'class': 'label-wrapper',
      'width': this.options.label.width,
      'height': this.options.chart.height
    });

    foreign.append('xhtml:div').attr({
      'class': 'label ' + data.key
    }).append('xhtml:span').attr('class', 'croptext');
  };

  BulletChart.prototype.animate = function (animate) {
    if (typeof animate !== 'boolean')
      return this.animations;
    this.animations = animate;
    return this;
  };

  BulletChart.prototype.showPopup = function (data, position) {
    this.popup.popup('close');
    this.popup.find('.target.value').html(this.options.numberFormat(data.baseline));
    this.popup.find('.current.value').html(this.options.numberFormat(data.current));
    this.popup.find('.percentage.value').html(parseInt((data.current * 100) / data.baseline, 10) + '%');
    this.popup.popup('open', position);
    return this;
  };

  BulletChart.prototype.hidePopup = function () {
    this.popup.popup('close');
    return this;
  };

  BulletChart.prototype.togglePopup = function (bullet, event) {
    var hasPopup = bullet.classed('has-popup');
    var data = bullet.data()[0];
    this.group.selectAll('g.bullet-chart.has-popup').classed('has-popup', false);
    bullet.classed('has-popup', !hasPopup);

    this.hidePopup();
    if (!hasPopup) {
      this.showPopup(data, {
        x: event.pageX,
        y: event.pageY
      });
    }
  };

  BulletChart.prototype.toggleSelect = function (bullet) {
    var isSelected = bullet.classed('selected');
    var data = bullet.data()[0];
    bullet.classed('selected', !isSelected);
    this.svg.classed('has-selected', this.group.selectAll('g.bullet-chart.selected').size() > 0);
    if (!isSelected) {
      this.showMarkers(data).addFilter(data);
    } else {
      this.removeMarkers().removeFilter(data);
    }

    return this;
  };

  BulletChart.prototype.showMarkers = function (data) {
    this.removeMarkers();
    var y1 = data.__y__;
    var y2 = this.getSVGHeight() + this.options.chart.margin.top;

    if (this.options.axisPosition === 'top') {
      y1 = this.options.chart.margin.top * -1;
      y2 = data.__y__ + this.options.chart.height;
    }

    this.marker.append('line').attr({
      'x1': data.__target_x__ + 2,
      'x2': data.__target_x__ + 2,
      'y1': y1,
      'y2': y2,
      'stroke-dasharray': '5, 5'
    });
    //create path
    return this;
  };

  BulletChart.prototype.removeMarkers = function () {
    //remove path
    this.marker.select('line').remove();
    return this;
  };

  BulletChart.prototype.addFilter = function (data) {
    var uid = this.generateUID(data.key);
    if (!(uid in this.filters))
      this.filters[uid] = {name: data.key};

    this.trigger('filter', [this.filters]);
    return this;
  };

  BulletChart.prototype.updateFilterInfo = function (filters) {
    if (!Utils.isArray(filters))
      return this;

    var self = this;
    filters.forEach(function(filter) {
      var key = self.generateUID(filter.value);
      if (key in self.filters && filter.id)
        self.filters[key].id = filter.id;
    });
  };

  BulletChart.prototype.generateUID = function (str) {
    str = (str || '').replace(/[^a-z0-9]/i, '');
    return str + str.length;
  };

  BulletChart.prototype.removeFilter = function (data) {
    var uid = this.generateUID(data.key);
    var filters;
    var index;
    if (!(uid in this.filters)) {
      return this;
    }
    filters = [this.filters[uid]];
    delete this.filters[uid];

    this.trigger('remove-filter', [filters]);
    return this;
  };

  BulletChart.prototype.clearFilters = function () {
    var filters = [];
    var key;
    for (key in this.filters) {
      filters.push(this.filters[key]);
    }
    this.filters = {};
    this.trigger('remove-filter', [filters]);
    return this;
  };

  /**
   * Adds an event listener
   * @param String type event name
   * @param Function callback to execute
   * @return BulletChart
   *
   */
  BulletChart.prototype.addEventListener = function (type, callback) {
    if (!(type in this.events)) {
      this.events[type] = [];
    }
    this.events[type].push(callback);
    return this;
  };

  /**
   * Triggers an event calling all of the callbacks attached to it.
   * @param String type event name
   * @param Array args to pass to the callback
   * @param Object thisArg to execute the callback in a certain context
   * @return BulletChart
   *
   */
  BulletChart.prototype.trigger = function (type, args, thisArg) {
    if ((type in this.events) && this.events[type].length) {
      args = jQuery.isArray(args) ? args : [];
      thisArg = thisArg || this;
      this.events[type].forEach(function (callback) {
        callback.apply(thisArg, args);
      });
    }
    return this;
  };


  if (!('Visualizations' in main))
    main.Visualizations = {};

  main.Visualizations.BulletChart = BulletChart;
})(this);
