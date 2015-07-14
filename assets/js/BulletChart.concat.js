(function (main) {
  'use strict';
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  var formats = {
    raw: function () {
      var decimals = d3.format('.2f');
      var integers = d3.format('');
      return function (value) {
        return (value + '').split('.').length > 1 ? decimals(value) : integers(value);
      };
    },
    currency: function (opts) {
      opts = utils.isObject(opts) ? opts : {};
      if (!opts.symbol)
        opts.symbol = '$';
      var format = formats.thousands(opts);
      return function (value) {
        return opts.symbol + ' ' + format(value);
      };
    },
    thousands: function (opts) {
      var format = ',';
      opts = utils.isObject(opts) ? opts : {};
      if (opts.decimals)
        format += '.2';
      if (opts.si)
        format += 's';
      format += 'f';
      return d3.format(format);
    },
    axis: function (formatter) {
      if (!formatter || typeof formatter !== 'function')
        formatter = String;

      var suffixFormatter = d3.format('s');
      return function (value) {
        //Remove all non integer values
        value = parseInt(value, 10);
        var formatted = suffixFormatter(value);
        var suffix = formatted.replace(/\d+/, '');
        value = formatted.replace(/[^\d]+/, '');
        return formatter(value) + suffix;
      };
    }
  };
  var utils = {
    isDesigner: function () {
      return xdo && xdo.app && xdo.app.designer && xdo.app.designer.DesignerApplication;
    },
    proxy: function (fn, thisArg) {
      return function () {
        return fn.apply(thisArg, utils.toArray(arguments));
      };
    },
    toArray: function (obj) {
      return Array.prototype.slice.call(obj);
    },
    stringToBoolean: function(obj){
      return typeof obj === 'boolean' ? obj : obj.toLowerCase() === "true";
    },
    deferred: jQuery.Deferred,
    pluck: function (data, key) {
      var values = [];
      if (utils.isArray(data)) {
        values = data.map(function (value) {
          return value[key];
        });

        values = values.filter(function (value) {
          return typeof value !== 'undefined' && value !== null;
        });
      }
      return values;
    },
    isObject: function (obj) {
      return jQuery.isPlainObject(obj);
    },
    isFunction: function (method) {
      return typeof method === 'function';
    },
    format: function (format, opts) {
      if (!(format in formats))
        format = 'raw';
      return formats[format](opts);
    },
    capitalize: function (text) {
      return (text + '').toLowerCase().replace(/_/g, ' ');
    },
    ascending: function (a, b) {
      if (!isNaN(a) && !isNaN(b))
        return d3.ascending(+a, +b);
      return (a + '').localeCompare(b);
    },
    descending: function (a, b) {
      if (!isNaN(a) && !isNaN(b))
        return d3.descending(+a, +b);
      return (b + '').localeCompare(a);
    },
    isEmptyObject: jQuery.isEmptyObject,
    isArray: jQuery.isArray,
    extend: jQuery.extend
  };

  if (!('bimad' in main))
    main.bimad = {};

  if ('utils' in main.bimad)
    utils = utils.extend(utils, main.bimad.utils);

  main.bimad.utils = utils;
})(this);
;(function (main) {
  'use strict';
  /* jshint unused:true, jquery:true, curly:false */
  /* global bimad */

  function getFieldName (field) {
    var last;
    var name = '';
    if (typeof field === 'string') {
      field = field.slice(field.lastIndexOf('/') + 1);
      last = field.indexOf(':');
      last = last > 0 ? last + 1 : field.length;
      name = field.slice(0, last);
    }
    return name;
  }

  var Parser = {
    date: function (data) {
      var date = new Date(data);
      var year = date.getFullYear().toString();
      var month = date.getMonth().toString();
      return {
        date: date,
        year: year,
        month: month,
        yearmonth: year + month
      };
    },
    parse: function (data) {
      return data;
    }
  };

  var Postprocessors = {
    date: function (node, index, length, meta) {
      //extend the object by parsing the date
      var date;
      var month = 0;
      var day = 1;
      if (meta.aggregate === 'year') {
        date = new Date(node.key, month, day);
      } else if(meta.aggregate === 'yearmonth') {
        month = (length - 1) === index ? 11 : node.key.substring(4);
        day = (length - 1) === index ? 31 : 1;
        date = new Date(node.key.substring(0, 4), node.key.substring(4), day);
      }
      node[meta.name] = date;
    }
  };


  /**
   * Creates a new data model to manipulate the data
   * @param data Array Array of arrays
   * @param metadata Array Column metadata
   */
  var DataModel = function (data, metadata) {
     if (bimad.utils.isArray(data))
       this.setData(data);

     if (bimad.utils.isArray(metadata))
       this.setColumnMetadata(metadata);

     this.sort = {
       by: null,
       comparator: d3.descending
     };
     this.aggregators = {};
     this.columnOrder = [];
  };

  /**
   * Sets the column metadata. This information is given as a parameter to the BIMAD Plugin
   * @param metadata Array Column metadata
   * @return DataModel
   */
  DataModel.prototype.setColumnMetadata = function (meta) {
    var metaData = {};
    var numericColumns = [];
    var columns = [];
    meta.forEach(function (column) {
      var field = column.field;
      var last;
      metaData[column.name] = column;
      if (typeof column.label === 'undefined')
        column.label = getFieldName(column.field);

      column.parser = (column.dataType in Parser) ? column.dataType : 'parse';
      columns.push(column.name);
      if (column.fieldType === 'measure')
        numericColumns.push(column.name);
    });
    this.numericColumns = numericColumns;
    this.metaData = meta;
    this.indexedMetaData = metaData;
    this.columns = columns;
    this.doAggregate = true;
    return this;
  };

  /**
   * Sets the data to work on
   * @param data Array
   * @return DataModel
   */
  DataModel.prototype.setData = function (data) {
    this.data = data;
    return this;
  };

  /**
   * Indexes the data with the column metadata information
   * @return DataModel
   */
  DataModel.prototype.indexColumns = function () {
    var indexed = [];
    var columns = this.columns;
    var metadata = this.indexedMetaData;
    this.data.forEach(function (row) {
      var indexedRow = {};
      row.forEach(function (value, index) {
        var name = columns[index];
        var type = metadata[name].parser;
        indexedRow[name] = value;
        indexedRow[name + '_parsed'] = Parser[metadata[name].parser](value);
      });
      indexed.push(indexedRow);
    });
    this.indexedData = indexed;
    return this;
  };

  /**
   * Sets the colum order to create the hierarchical object.
   * All numeric columns will be discarded and placed at the end of the hierarchy.
   * If second argument is specified as false the nest method will only include the fields specified on the columns parameter
   * If second argument is missing or true, then the hierarchical data will include first the columns specified, and then the
   * rest of te string columns.
   * @param columns Array
   * @param nestExtras Boolean Default true, will include extra string columns in the hierarchy
   * @returns DataModel
   */
  DataModel.prototype.setColumnOrder = function (columns, nestExtras) {
    nestExtras = typeof nestExtras === 'boolean' ? nestExtras : true;
    var columnOrder = [];
    var extraColumns = nestExtras ? this.metaData.slice() : [];
    if (!bimad.utils.isArray(columns))
      columns = [];

    if (columns.length > 0) {
      // first add the string columns that come in the ordered array
      columns.forEach(function (column) {
        if (column in this.indexedMetaData && this.indexedMetaData[column].fieldType !== 'measure')
          columnOrder.push(column);
      }, this);
      //Then add any missing string columns to the end of the array
      extraColumns.forEach(function (column) {
        if (columns.indexOf(column.name) === -1 && column.fieldType !== 'measure')
          columnOrder.push(column.name);
      });
    }
    this.columnOrder = columnOrder;
    return this;
  };

  /**
   * Sets the sorting method by keys
   * @returns DataModel
   */
  DataModel.prototype.sortBy = function (key) {
    if (key in this.indexedMetaData)
      this.sort.by = key;
    return this;
  };

  /**
   * Sets the comparator method to ascending
   * @returns DataModel
   */
  DataModel.prototype.asc = function () {
    this.sort.comparator = bimad.utils.ascending;
    return this;
  };

  /**
   * Sets the sorting method descending
   * @returns DataModel
   */
  DataModel.prototype.desc = function () {
    this.sort.comparator = bimad.utils.descending;
    return this;
  };

  /**
   * Creates the hierarchical object based on the column order
   * @return Object
   */
  DataModel.prototype.nest = function () {
    var aggregators = this.aggregators;
    var meta = this.indexedMetaData;
    var nest = d3.nest();
    var rollups = {};
    var columnTypes = [];
    var root = {
      key: 'root',
    };
    var nested;

    this.columnOrder.forEach(function (column) {
      var columnMeta = meta[column];
      var aggregator = aggregators[columnMeta.dataType];
      columnTypes.push(columnMeta);
      nest.key(function (node) {
        return aggregator ? aggregator(node, column) : node[column];
      });
    });

    if (this.doAggregate) {
      //Create this object dinamically based on the numeric columns
      this.numericColumns.forEach(function (column) {
        rollups[column] = function (leaves) {
          return d3.sum(leaves, function (node) { return node[column]; });
        };
      });

      nest.rollup(function (leaves) {
        var rollup = {};
        for (var key in rollups)
          rollup[key] = rollups[key](leaves);

        return rollup;
      });
    }

    nested = nest.entries(this.indexedData);

    root.values = nested;
    this.numericColumns.forEach(function (column) {
      accumulate(root, column);
    });
    postProcess(root, columnTypes);

    if (this.sort.by)
      sort(root.values, this.sort.by, this.sort.comparator);

    return root;
  };

  DataModel.prototype.aggregate = function (aggregate) {
    if (typeof aggregate === 'undefined')
      return this.doAggregate;

    this.doAggregate = typeof aggregate === 'boolean' ? aggregate : !!aggregate;
    return this;
  };

  DataModel.prototype.dateGroupBy = function (aggregate) {
    var aggregators = {'year': true, 'month': true, 'yearmonth': true};
    var key;
    var column;
    if (!(aggregate in aggregators))
      aggregate = 'year';

    for (key in this.indexedMetaData) {
      column = this.indexedMetaData[key];
      if (column.dataType === 'date')
        column.aggregate = aggregate;
    }
    //create the aggregator and store it for later use
    this.aggregators.date = function (data, column) {
      return data[column + '_parsed'][aggregate];
    };

    return this;
  };

  function sort (data, key, order) {
    if (!bimad.utils.isArray(data))
      return false;

    if (typeof order !== 'function')
      order = bimad.utils.descending;

    data.sort(function (nodeA, nodeB) {
      return order(nodeA[key], nodeB[key]);
    });

    //means we have a hierarchical data of more than one level of depth
    if (bimad.utils.isArray(data[0].values)) {
      data.forEach(function (node) {
        sort(node.values, key, order);
      });
    }

    return true;
  }

  function accumulate (node, key) {
    if (bimad.utils.isObject(node) && !bimad.utils.isEmptyObject(node)) {
      return (bimad.utils.isArray(node.values)) ?
        node[key] = node.values.reduce(function (prev, value) {
          return prev + accumulate(value, key);
        }, 0) :
        node[key] = node.values ? node.values[key] : node[key];
    }
  }

  function postProcess (data, columns) {
    if (data.values && bimad.utils.isArray(data.values)) {
      var valuesLength = data.values.length;
      var column = columns.shift();
      data.values.forEach(function (node, index) {
        if (column && column.dataType in Postprocessors)
          Postprocessors[column.dataType](node, index, valuesLength, column);
        postProcess(node, columns);
      });
    } else if (data.values) {
      delete data.values;
    }
  }

  if (!('bimad' in main))
    main.bimad = {};

  if (!('utils' in main.bimad))
    main.bimad.utils = {};

  if (!('DataModel' in main.bimad.utils))
    main.bimad.utils.DataModel = DataModel;

})(this);
;(function (main) {
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  /* global d3 */
  /* global bimad */
  'use strict';

  var LABEL_WIDTH = 0.39;
  var MAX_LABEL_WIDTH = 150;
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
    opts = bimad.utils.isObject(opts) ? opts : {};
    this.options = bimad.utils.extend({}, BulletChart.DEFAULTS, opts);
    this.animations = false;
    //dummy methods for popup
    this.popup = {
      close: function () {},
      open: function () {}
    };
    this.init();
    this.events = {
      'filter': [],
      'remove-filter': []
    };
    this.filters = {};

    this.setData(data);

    //hide dom filters
    var filter = container.parentNode.querySelector('.filterinfo');
    if (filter)
      filter.style.display = 'none';
    if (!this.options.baseLineFormat)
      this.options.baseLineFormat = this.options.numberFormat;
    if (!this.options.currentFormat)
      this.options.currentFormat = this.options.numberFormat;

  };

  BulletChart.DEFAULTS = {
    axis: {
      height: 20
    },
    showLabel: true,
    axisOnChart: false,
    labelPosition: 'left',
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
    legend: {
      height: 0,
      paddingTop: 10,
      paddingBottom: 10
    },
    renderLegends: true,
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
    return data.key.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-{2,}/g, '-');
  };

  BulletChart.prototype.calculateLayout = function () {
    var opts = this.options;

    if (opts.labelPosition === 'right' || opts.labelPosition === 'left') {
      opts.label.width = opts.width * LABEL_WIDTH;
      opts.label.width = opts.label.width > MAX_LABEL_WIDTH ? MAX_LABEL_WIDTH : opts.label.width;
      opts.chart.width = (opts.width - opts.label.width) * 0.95;
    } else {
      opts.label.width = opts.width;
      opts.chart.width = opts.width * 0.95;
      opts.margin.left = 20;
    }

    if (!opts.renderLegends)
      opts.chart.margin.top = 10;

    opts.chart.inner = {
      height: opts.chart.height  * INNER_HEIGHT
    };

    opts.chart.target = {
      height: opts.chart.inner.height * 2,
      width: 3
    };

    opts.chart.inner.padding = (opts.chart.height - opts.chart.inner.height) / 2;
    return this;
  };

  BulletChart.prototype.createAxisWrapper = function () {
    var axisWrapper;
    if (this.options.axisOnChart)
      return this;

    if (this.options.axisPosition === 'top')
      axisWrapper = this.container.insert('svg', 'div.chart-wrapper');
    else
      axisWrapper = this.container.append('svg');

    axisWrapper.attr({
      'class': 'axis-wrapper',
      'height': this.options.axis.height,
      'width': this.options.width
    });
    this.axis = axisWrapper.append('g').attr('class', 'axis');
    return this;
  };

  BulletChart.prototype.createDOM = function () {
    var chartHeight = this.options.height;
    chartHeight -= this.options.axisOnChart ? 0 : this.options.axis.height;
    this.svg = this.container.append('div').attr({
      'class': 'chart-wrapper'
    }).append('svg');

    this.svg.attr({
      'class': 'bullet-charts-container',
      'width': this.options.width,
      'height': this.options.height
    });

    this.renderLegends().createAxisWrapper();
    chartHeight -= this.options.legend.height;
    this.container.select('div.chart-wrapper').style({
      'max-height': chartHeight + 'px'
    });

    this.group = this.svg.append('g').attr({
      'class': 'bullet-charts-group',
      'transform': 'translate(' + this.options.margin.left + ',' + this.options.chart.margin.top + ')'
    });
    this.bullets = this.group.selectAll('g.bullet-chart');
    this.marker = this.group.append('g').attr('class', 'marker');
    return this;
  };


  /**
   * Initializes the Bullet chart plugin
   *
   */
  BulletChart.prototype.init = function () {
    this.setColors(this.options.colors);
    this.calculateLayout().createDOM();
    var svg = this.svg.node();
    var self = this;

    this.scale = d3.scale.linear().range([0, this.options.chart.width]);
    this.renderPopup();


    jQuery(svg).on('tap.bullet-chart', '.graphic', function (event) {
      self.togglePopup(d3.select(this.parentNode), event);
    }).on('tap.bullet-chart', '.label-container', function () {
      self.toggleSelect(d3.select(this.parentNode));
    });

    document.body.addEventListener('click', function (event) {
      if (bimad.utils.isDesigner())
        return this;
      var target = $(event.target || event.srcElement);
      if (!target.is('g.bullet-chart') && !target.parents('g.bullet-chart').length && !target.is('.ui-popup-container') && !target.parents('.ui-popup-container').length) {
        self.popup.close();
        self.svg.selectAll('.bullet-chart').classed('has-popup', false);
      }
      return this;
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
    if (bimad.utils.isObject(data))
      data = [data];

    BUFFER = data.length > 1 ? BUFFER : 1;
    this.data = data;

    var scale = this.scale;
    var opts = this.options;
    var thresholds = d3.entries(opts.thresholds);
    var thresholdsVal = d3.values(opts.thresholds);
    var maxCurrent = d3.max(bimad.utils.pluck(data, 'current'));
    var maxPast = d3.max(bimad.utils.pluck(data, 'baseline'));
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

    this.axisHelper = d3.svg.axis();
    this.axisHelper.orient(opts.axisPosition);
    this.axisHelper.ticks(4).scale(scale).tickFormat(opts.axisFormat);

    return this;
  };

  BulletChart.prototype.getSVGHeight = function () {
    var opts = this.options;
    var bulletHeight = (opts.chart.margin.top + opts.chart.height);
    bulletHeight *= opts.labelPosition === 'top' ? 2 : 1;
    bulletHeight += opts.axisOnChart ? opts.axis.height : 0;
    return bulletHeight * this.data.length;
  };

  BulletChart.prototype.getAxisPosition = function () {
    var labelPosition = this.options.labelPosition;
    var axisPosition = this.options.axisPosition;
    var x = this.options.margin.left;
    var y = axisPosition === 'top' ? this.options.axis.height : 1;
    x += labelPosition === 'left' ? this.options.label.width : 0;
    return 'translate(' + x + ',' + y + ')';
  };

  BulletChart.prototype.getMarkerPosition = function () {
    var labelPosition = this.options.labelPosition;
    var x = labelPosition === 'top' ? 0 : this.options.label.width;
    return 'translate(' + x + ', 0)';
  };

  BulletChart.prototype.createChartAxis = function () {
    if (this.options.axisOnChart)
      return this;

    var axis = this.axis;

    this.axis.attr({
      'transform': this.getAxisPosition()
    });

    if (this.animations)
      axis = axis.transition().duration(700).delay(200);

    axis.call(this.axisHelper);
    return this;
  };

  BulletChart.prototype.createBulletAxis = function (bullet) {
    if (!this.options.axisOnChart)
      return this;
    var axis = bullet.select('g.axis-wrapper');
    if (!axis.size()) {
      var y = this.options.chart.height;
      y *= this.options.showLabel ? 2 : 1;
      axis = bullet.append('g').attr({
        'class': 'axis-wrapper',
        'transform': 'translate(0, ' + y + ')'
      });
    }

    if (this.animations)
      axis = axis.transition().duration(700).delay(200);

    axis.call(this.axisHelper);
    return this;
  };

  BulletChart.prototype.render = function () {
    var renderInner = bimad.utils.proxy(this.renderInnerChart, this);
    var opts = this.options;
    var self = this;

    if (this.data.length) {
      this.group.attr({
        'transform': 'translate(' + this.options.margin.left + ',' + this.options.chart.margin.top + ')'
      });
    }

    this.svg.attr('height', this.getSVGHeight());
    this.container.select('div.chart-wrapper').style({
      'height': this.getSVGHeight() + 'px'
    });
    this.marker.attr({
      'transform': this.getMarkerPosition()
    });
    this.bullets = this.bullets.data(this.data, BulletChart.key);
    this.bullets.enter().insert('g', 'g.marker').attr({
      'class': 'bullet-chart'
    });

    this.createChartAxis();

    this.bullets.attr({
      'transform': function (data, index) {
        return self.getBulletPosition(index);
      }
    });
    this.bullets.exit().remove();
    this.bullets.each(function (data) {
      renderInner(d3.select(this), data);
    });
  };

  BulletChart.prototype.renderInnerChart = function (bullet, data) {
    var labelsData = [
      {key: 'group', value: data.key}
    ];
    if (!this.options.showLabel)
      labelsData = [];
    var labelsContainer = bullet.selectAll('g.label-container').data(labelsData, BulletChart.key);
    var graphic = bullet.select('g.graphic');
    var opts = this.options;
    var self = this;
    if (!graphic.size()) {
      graphic = bullet.append('g').attr({
        'class': 'graphic',
        'transform': this.getGraphicPosition()
      });
    }
    var threshold = graphic.selectAll('rect.threshold').data(data.__thresholds__, BulletChart.key);
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
    this.createBulletAxis(bullet);
  };

  BulletChart.prototype.getLabelPosition = function () {
    var x = 0;
    var y = 0;
    return 'translate(' + x + ', ' + y + ')';
  };

  BulletChart.prototype.renderLegends = function () {
    if (!this.options.renderLegends)
      return this;

    var padding = this.options.labelPosition === 'top' ? this.options.chart.margin.top : 0;
    var colors =  this.colors;
    var lineWidth = 6;
    var lineHeight = 18;
    var labelWidth = ((this.options.width - padding) / 2);
    labelWidth = labelWidth - (labelWidth * 0.1);
    this.legends = this.container.insert('div', 'div.chart-wrapper');
    this.legends.attr({
      'class': 'bullet-legends'
    }).style({
      'width': this.options.width + 'px',
      'padding-top': this.options.legend.paddingTop + 'px',
      'padding-bottom': this.options.legend.paddingBottom + 'px'
    }).append('div').attr({
      'class': 'text-wrapper'
    });
    var wrapper = this.legends.select('.text-wrapper');


    wrapper.insert('div').attr({
      'class': 'current legend'
    }).style({
      'background-color': colors('current'),
      'height': this.options.chart.inner.height + 'px',
      'width': lineHeight + 'px',
      'margin-bottom': '2px'
    });
    wrapper.append('div').attr('class', 'current label').html(
      bimad.utils.capitalize(this.options.currentLabel)
    );
    wrapper.append('div').attr({
      'class': 'target legend'
    }).style({
      'background-color': colors('target'),
      'width': this.options.chart.target.width + 'px',
      'height': this.options.chart.target.height + 'px'
    });
    wrapper.append('div').attr('class', 'target label').html(
      bimad.utils.capitalize(this.options.targetLabel)
    );

    this.options.legend.height = this.legends.node().clientHeight;

    return this;
  };

  BulletChart.prototype.getGraphicPosition = function () {
    var x = 0;
    var y = 0;
    if (this.options.labelPosition === 'top' && this.options.showLabel)
      y = this.options.chart.height;
    if (this.options.labelPosition === 'left')
      x = this.options.label.width;
    return 'translate(' + x + ', ' + y + ')';
  };

  BulletChart.prototype.getBulletPosition = function (index) {
    var y = (this.options.chart.height + this.options.chart.margin.top);
    y *= (this.options.labelPosition === 'top') ? 2 : 1;
    return 'translate(0, ' + (y * index) + ')';
  };

  BulletChart.prototype.renderPopup = function () {
    if (bimad.utils.isDesigner())
      return this;
    var $container = $(this.container.select('div.chart-wrapper'));
    var popup = $container.find('div.popup');
    var popupWidth;
    if (!popup.length) {
      popup = document.createElement('div');
      document.body.appendChild(popup);
      //this.container.node().appendChild(popup);
      popup = $(popup).attr('class', 'popup');

      popup.attr({
        'class': 'popup-bullet-chart hide',
      });

      var popupContent = [];
      popupContent.push('<div class="details">');
      popupContent.push('<div class="detail">');
      popupContent.push('<div class="target label list-item">' + bimad.utils.capitalize(this.options.targetLabel) + '</div>');
      popupContent.push('<div class="target value list-item"></div>');
      popupContent.push('</div>');
      popupContent.push('<div class="detail">');
      popupContent.push('<div class="current label list-item">' + bimad.utils.capitalize(this.options.currentLabel) + '</div>');
      popupContent.push('<div class="value list-item current"></div>');
      popupContent.push('</div>');
      popupContent.push('<div class="inline-detail">');
      popupContent.push('<span class="value percentage"></span>');
      popupContent.push('<span class="label percengage"> of the Target ' + bimad.utils.capitalize(this.options.targetLabel) + '</span>');
      popupContent.push('</div>');
      popupContent.push('</div>');

      this.popup = popup.html(popupContent.join(''));
      this.popup.open = function (position) {
        popup.removeClass('hide').css({
          left: position.left,
          top: position.top
        });
      };

      this.popup.close = function () {
        popup.addClass('hide');
      };
    }

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
    }).style({
      'font-size': this.options.labelFontSize + 'px'
    }).append('xhtml:span').attr('class', 'croptext');
  };

  BulletChart.prototype.animate = function (animate) {
    if (typeof animate !== 'boolean')
      return this.animations;
    this.animations = animate;
    return this;
  };

  BulletChart.prototype.showPopup = function (data, position) {
    if (bimad.utils.isDesigner())
      return this;
    this.popup.close();
    this.popup.find('.target.value').html(this.options.baseLineFormat(data.baseline));
    this.popup.find('.current.value').html(this.options.currentFormat(data.current));
    this.popup.find('.percentage.value').html(parseInt((data.current * 100) / data.baseline, 10) + '%');
    this.popup.open(position);
    return this;
  };

  BulletChart.prototype.hidePopup = function () {
    if (bimad.utils.isDesigner())
      return this;
    this.popup.close();
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
        left: (event.pageX + 5) + 'px',
        top: (event.pageY - 10) + 'px'
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
    if (!bimad.utils.isArray(filters))
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
