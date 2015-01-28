{
  id: '03efcb62a28c.BulletChart',
  component: {
    'name': 'Bullet Chart',
    'tooltip': 'Insert Bullet Chart'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "320px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "numberformat", label: "Numeric Format", type: "lov", options: [
      {label: 'Raw', value: 'raw'},
      {label: 'Currency', value: 'currency'},
      {label: 'Thousands separated', value: 'thousands'}
    ], value: 'currency'},
    {key: "numberprefix", label: "Numeric Prefix (3.2k)", type: "boolean", value: true},
    {key: "currencysymbol", label: "Currency Symbol", type: "string", value: ""},
    {key: "lowest", label: "Lower Level %", type: "number", value: "33"},
    {key: "middle", label: "Middle Level %", type: "number", value: "66"},
    {key: "higher", label: "Higher Level %", type: "number", value: "140"}
  ],
  remoteFiles: [
    {
      type:'js',
      location: 'asset://js/BulletChart.concat.js',
      isLoaded: function() {
        return 'Visualizations' in window && 'BulletChart' in Visualizations;
      }
    },
    {
      type:'css',
      location:'asset://css/style.css'
    }
  ],
  fields: [
    {name: "group", caption: "Drop Group", fieldType: "label", dataType: "string"},
    {name: "current", caption: "Drop Current Value", fieldType: "measure", dataType: "number", formula: "summation"},
    {name: "baseline", caption: "Drop Baseline", fieldType: "measure", dataType: "number", formula: "summation"}
  ],
  avoidRefresh: false,
  dataType: 'arrayOfArrays',
  render: function (context, container, data, fields, props) {
    container.innerHTML = '';

    this.dataModel = new Utils.DataModel(data, fields);
    this.dataModel.setColumnOrder([
     'group'
     ]).sortBy('baseline').desc().indexColumns();

    props.numberprefix = typeof props.numberprefix !== 'boolean' ? props.numberprefix === 'true' : props.numberprefix;
    this.visualization = new Visualizations.BulletChart(container, this.dataModel.nest().values, {
      width: parseInt(props.width, 10),
      height: parseInt(props.height, 10),
      numberFormat: Utils.format(props.numberformat, {
        symbol: props.currencysymbol
      }),
      axisFormat: Utils.format(props.numberformat, {
        symbol: props.currencysymbol,
        si: true
      }),
      thresholds: {
        lowest: +props.lowest,
        middle: +props.middle,
        higher: +props.higher
      }
    });
    this.visualization.render();
  },
  refresh: function (context, container, data, fields, props) {
    if (!this.avoidRefresh) {
      this.dataModel.setData(data).indexColumns();
      this.visualization.animate(true);
      this.visualization.setData(this.dataModel.nest().values).render();
    }
    this.avoidRefresh = false;

  }
}
