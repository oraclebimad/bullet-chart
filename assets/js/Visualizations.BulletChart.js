(function (main) {
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  /* global d3 */
  /* global utils */
  'use strict';

  var LABEL_WIDTH = 0.29;
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
    target: 110
  };

  BulletChart.key = function (data) {
    return data.key;
  };


  /**
   * Initializes the Bullet chart plugin
   *
   */
  BulletChart.prototype.init = function () {
    var width;
    this.svg = this.container.append('div').attr('class', 'chart-wrapper').append('svg');
    this.svg.attr({
      'class': 'bullet-charts-container',
      'width': this.options.width,
      'height': this.options.height
    });
    this.group = this.svg.append('g').attr('class', 'bullet-charts-group');
    this.bullets = this.group.selectAll('g.bullet-charts');
    this.options.label.width = this.options.width * LABEL_WIDTH;
    this.options.chart.inner = {
      height: this.options.chart.height  * INNER_HEIGHT
    };

    this.options.chart.inner.padding = (this.options.chart.height - this.options.chart.inner.height) / 2;

    width = this.options.chart.width = this.options.width * (1 - LABEL_WIDTH - 0.1);
    this.thresholds = d3.values(this.options.thresholds);
    this.scale = d3.scale.linear().range([0, this.options.chart.width]);
    return this;
  };

  BulletChart.prototype.setData = function (data) {
    var scale = this.scale;
    var opts = this.options;
    var thresholds = this.thresholds;
    this.data = data;
    var maxCurrent = d3.max(Utils.pluck(data, 'current'));
    var maxPast = d3.max(Utils.pluck(data, 'baseline'));
    var totalWidth = this.options.chart.width;

    scale.domain([0, Math.max(maxCurrent, maxPast, maxPast * (opts.target / 100))]);
    console.log(scale.domain());
    //calculate the target, and thresholds values
    this.data.forEach(function (node) {
      //baseline
      //current
      var target = node.baseline * (opts.target / 100);
      var bulletThreshold = [];
      var widthSum = 0;
      thresholds.forEach(function (threshold, index) {
        var width = scale(removeExponential((threshold / 100) * target));
        var x = bulletThreshold[index - 1] ? bulletThreshold[index - 1].width + bulletThreshold[index - 1].x : 0;
        widthSum += width;
        //if we dont have any other width, we need to adjust the threshold width to fit the full width
        if (!thresholds[index + 1]) {
          width = (totalWidth - widthSum) + width;
        }
        //construct the object with the rendering data
        bulletThreshold.push({
          width: width,
          x: x,
          originalWidth: scale(removeExponential((threshold / 100) * target))
        });
      });
      node.target = target;
      node.__target_x__ = removeExponential(scale(node.target));
      node.__width__ = removeExponential(scale(node.current));
      node.__thresholds__ = bulletThreshold;
    });
    console.log(totalWidth, this.data);
    return this;
  };

  BulletChart.prototype.render = function () {
    var renderInner = Utils.proxy(this.renderInnerChart, this);
    var opts = this.options;
    var self = this;

    this.svg.attr('height', (this.data.length * opts.chart.height) + (this.data.length * opts.chart.margin.top));
    this.bullets = this.bullets.data(this.data, BulletChart.key);
    this.bullets.enter().append('g').attr({
      'class': 'bullet-chart'
    });

    this.bullets.attr({
      'transform': function (data, index) {
        return 'translate(' + opts.margin.left + ',' + ((opts.chart.height  + opts.chart.margin.top) * index) + ')';
      }
    });

    this.color = d3.scale.category20c().domain(d3.entries(this.options.thresholds));

    this.bullets.exit().remove();
    this.bullets.each(function (data) {
      renderInner(d3.select(this), data);
    });

  };

  BulletChart.prototype.renderInnerChart = function (bullet, data) {
    var labelsContainer = bullet.select('g.label-container');
    var graphic = bullet.select('g.graphic');
    var opts = this.options;
    var self = this;
    if (!labelsContainer.size()) {
      labelsContainer = bullet.append('g').attr({
        'class': 'label-container',
        'transform': 'translate(0, ' + (opts.chart.margin.top * 2) + ')'
      });
    }
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
      'width': function (d) {
        return d.width;
      },
      'x': function (d) {
        return d.x;
      }
    }).style({
      'fill': function (d, index) {
        return self.color(index);
      }
    });
    current.enter().append('rect').attr({
      'class': 'current',
      'height': opts.chart.inner.height,
      'y': opts.chart.inner.padding,
      'width': 0
    }).style({
      'fill': function (d) {
        return self.color(d.key);
      }
    });

    target.enter().append('rect').attr({
      'class': 'target',
      'height': opts.chart.inner.height + 3,
      'y': opts.chart.inner.padding - 1.5,
      'x': 0,
      'width': 3
    });

    var label = labelsContainer.selectAll('text.label').data(d3.entries({
      group: data.key,
      current: data.current
    }), BulletChart.key);
    label.enter().append('text').attr({
      'class': function (d) {
        return 'label ' + d.key;
      },
      'dy': function (d) {
        return d.key === 'current' ? '.5em' : '-.5em';
      }
    });

    label.text(function (d) {
      return isNaN(d.value) ? d.value : self.format(d.value);
    });

    //animation
    if (self.animations) {
      target = target.transition().delay(200).duration(700);
      current = current.transition().delay(200).duration(700);
    }

    current.attr('width', function (d) {
      return d.value > 0 ? d.value : 0;
    });
    target.attr('x', function (d) {
      return d.value;
    });
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
