(function (main) {
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  /* global d3 */
  /* global utils */
  'use strict';

  var LABEL_WIDTH = 0.29;
  var INNER_HEIGHT = 0.30;

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
    this.thresholds = this.thresholds.map(function (threshold) {
      return (threshold / 100) * width;
    });
    this.scale = d3.scale.linear().range([0, this.options.chart.width]);
    return this;
  };

  BulletChart.prototype.setData = function (data) {
    this.data = data;
    var maxBaseline = d3.max(Utils.pluck(data, 'baseline'));
    var maxCurrent = d3.max(Utils.pluck(data, 'current'));

    this.scale.domain([0, Math.max(maxBaseline, maxCurrent)]);
    return this;
  };

  BulletChart.prototype.render = function () {
    var opts = this.options;
    var old;
    var newBullets;
    var self = this;

    this.svg.attr('height', (this.data.length * opts.chart.height) + (this.data.length * opts.chart.margin.top));
    this.bullets = this.bullets.data(this.data, BulletChart.key);
    newBullets = this.bullets.enter().append('g').attr({
      'class': 'bullet-chart'
    });

    this.bullets.attr({
      'transform': function (data, index) {
        return 'translate(' + opts.margin.left + ',' + ((opts.chart.height  + opts.chart.margin.top) * index) + ')';
      }
    });

    var color = d3.scale.category20c().domain(d3.entries(this.options.thresholds));
    newBullets.each(function (data) {
      var bullet = d3.select(this);
      var labelsContainer = bullet.append('g').attr({
        'class': 'label-container',
        'transform': 'translate(0, ' + (opts.chart.margin.top * 2) + ')'
      });
      var graphic = bullet.append('g').attr({
        'class': 'graphic',
        'transform': 'translate(' + opts.label.width + ', 0)'
      });
      var threshold = graphic.selectAll('rect.threshold').data(d3.entries(self.options.thresholds), BulletChart.key);
      var inner = graphic.selectAll('rect.inner').data([{key: 'current', value: data.current}],  BulletChart.key);
      var target = graphic.selectAll('rect.target').data([
        {key: 'target', value: data.baseline * (opts.target / 100)}
        ], BulletChart.key);
      //create background based on the max-width - left-label

      //create a scale to calculate the width of the thresholds based on:
      //the full width - some padding so we can show the target inside the background

      //create a the inner bar using the scale we just created

      //place the target marker using the scale

      threshold.enter().append('rect').attr({
        'class': function (d) {
          return 'threshold ' + d.value;
        },
        'height': opts.chart.height,
        'width': function (data, index) {
          var prev = index === 0 ? 0 : self.thresholds[index - 1];
          return self.thresholds[index] - prev;
        },
        'x': function (data, index) {
          return index === 0 ? 0 : self.thresholds[index - 1];
        }
      }).style({
        'fill': function (d) {
          return color(d.key);
        }
      });
      inner.enter().append('rect').attr({
        'class': 'inner',
        'height': opts.chart.inner.height,
        'y': opts.chart.inner.padding,
        'width': function (d) {
          return d.value > 0 ? self.scale(d.value) : 0;
        }
      }).style({
        'fill': function (d) {
          return color(d.key);
        }
      });
      target.enter().append('rect').attr({
        'class': 'target',
        'height': opts.chart.inner.height + 3,
        'y': opts.chart.inner.padding - 1.5,
        'x': function (d) {
          return self.scale(d.value);
        },
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
    });

  };

  if (!('Visualizations' in main))
    main.Visualizations = {};

  main.Visualizations.BulletChart = BulletChart;
})(this);
