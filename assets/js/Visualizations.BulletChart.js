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
   *
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

    if (Utils.isArray(data)) {
      this.setData(data);
    }


    this.format = Utils.format('thousands');

    //hide dom filters
    var filter = container.parentNode.querySelector('.filterinfo');
    if (filter)
      filter.style.display = 'none';
  };

  BulletChart.DEFAULTS = {
    axis: {height: 20},
    width: 400,
    height: 300,
    margin: {left: 10},
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

  BulletChart.key = function (data) {
    return data.key;
  };


  /**
   * Initializes the Bullet chart plugin
   *
   */
  BulletChart.prototype.init = function () {
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
    this.svg = this.container.append('div').attr('class', 'chart-wrapper').append('svg');

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
    this.axis = this.group.append('g');
    this.scale = d3.scale.linear().range([0, this.options.chart.width]);
    this.setColors(this.options.colors);
    return this;
  };

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
    console.log('maxCurrent', maxCurrent, 'maxPast', maxPast, 'maxDomain', maxDomain);

    var sums = 0;
    thresholds.forEach(function (threshold, index) {
      sums = d3.sum(thresholdsVal.slice(0, index)) - sums;
      threshold.step = (threshold.value - sums) / 100;
    });

    scale.domain([0, maxDomain]);
    //calculate the target, and thresholds values
    this.data.forEach(function (node) {
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
    });
    console.log(this.data, scale.domain(), scale.range());
    return this;
  };

  BulletChart.prototype.getSVGHeight = function () {
    var opts = this.options;
    var svgHeight = ((opts.chart.margin.top + opts.chart.height) * this.data.length) + opts.axis.height + opts.chart.margin.top;
    return svgHeight;
  };

  BulletChart.prototype.getAxisPosition = function () {
    var x = this.options.label.width / 2;
    var y = this.getSVGHeight() - this.options.axis.height - this.options.chart.margin.top;
    return 'translate(' + x + ',' + y + ')';
  };

  BulletChart.prototype.render = function () {
    var renderInner = Utils.proxy(this.renderInnerChart, this);
    var opts = this.options;
    var self = this;
    var axis = d3.svg.axis();
    axis.ticks(4).scale(this.scale).tickFormat(d3.format('s'));

    this.svg.attr('height', this.getSVGHeight());
    this.axis.attr({
      'class': 'axis',
      'transform': this.getAxisPosition()
    }).call(axis);
    this.bullets = this.bullets.data(this.data, BulletChart.key);
    this.bullets.enter().append('g').attr({
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
      {key: 'group', value: data.key},
      {key: 'current', value: data.current}
    ], BulletChart.key);
    var graphic = bullet.select('g.graphic');
    var opts = this.options;
    var self = this;
    if (!graphic.size()) {
      graphic = bullet.append('g').attr({
        'class': 'graphic',
        'transform': 'translate(' + (opts.label.width / 2) + ', 0)'
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
        var w = opts.label.width / 2;
        var x = (w + opts.chart.width) * index;
        return 'translate(' + x + ', 0)';
       }
    }).each(function (data) {
      self.createForeignObject(d3.select(this), data);
    });

    labelsContainer.each(function () {
      var label = d3.select(this).select('span.croptext');
      label.text(function (d) {
        return isNaN(d.value) ? d.value : self.format(d.value);
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

  BulletChart.prototype.createForeignObject = function (container, data) {
    var foreign = container.append('foreignObject').attr({
      'class': 'label-wrapper',
      'width': this.options.label.width / 2,
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

  if (!('Visualizations' in main))
    main.Visualizations = {};

  main.Visualizations.BulletChart = BulletChart;
})(this);
