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
    ]},
    {key: "currencysymbol", label: "Currency Symbol", type: "string", value: ""},
    {key: "target", label: "Target %", type: "numeric", value: "110"},
    {key: "lowest", label: "Lower Level %", type: "numeric", value: "30"},
    {key: "middle", label: "Middle Level %", type: "numeric", value: "60"},
    {key: "higher", label: "Higher Level %", type: "numeric", value: "90"}
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
    {name: "baseline", caption: "Drop Baseline", fieldType: "measure", dataType: "number", formula: "summation"},
    {name: "current", caption: "Drop Current Value", fieldType: "measure", dataType: "number", formula: "summation"}
  ],
  dataType: 'arrayOfArrays',
  render: function (context, container, data, fields, props) {
    container.innerHTML = '';

    this.dataModel = new Utils.DataModel(data, fields);
    this.dataModel.setColumnOrder([
     'group'
     ]).indexColumns();

    this.visualization = new Visualizations.BulletChart(container, this.dataModel.nest().values, {
      width: parseInt(props.width, 10),
      height: parseInt(props.height, 10)
    });
    this.visualization.render();
  },
  refresh: function (context, container, data, fields, props) {
  }
}
