export default {
  path: '/credit-stats',
  name: '/credit-stats',
  component: () =>
    import(
      /* webpackChunkName: "creditStats" */ '../../pages/credit-history-stats/index.vue'
    ),
  meta: {
    title: '积分统计',
    icon: 'el-icon-data-analysis',
    menu: true,
    // 不配置 key，跳过权限检查
  },
};
