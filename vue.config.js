module.exports = {
  "transpileDependencies": [
    "vuetify"
  ],
  publicPath: process.env.NODE_ENV === 'production' ? '/heartrate-graph/' : '/',
  pwa: {
    name: 'HeartRate Graph',
    themeColor: '#F44336'
  },
  productionSourceMap: false
}