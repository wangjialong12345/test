import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import layout from './layout/index.vue';
import customer from './routers/customer';
import selfhelp from './routers/selfhelp';
import keyWords from './routers/keyWords';
import relatedIssues from './routers/relatedIssues';
import avatar from './routers/avatar';
import admin from './routers/admin';
import returnsAndExchanges from './routers/returnsAndExchanges';
import refund from './routers/refund';
import updatePhoneNumber from './routers/updatePhoneNumber';
import activity from './routers/activity';
import sms from './routers/sms';
import jdRights from './routers/jdRights';
import blackList from './routers/blackList';
import invoice from './routers/invoice';
import creditStats from './routers/creditStats';

export const rootRoute: RouteConfig = {
  path: '',
  component: layout,
  redirect: '/customer',
  meta: {
    title: 'Calendar配置',
    icon: 'list',
  },
  children: [],
};

export const constantRoutes: RouteConfig[] = [
  {
    ...rootRoute,
    children: [],
  },
  {
    path: '/404',
    component: () =>
      import(/* webpackChunkName: "404" */ '../pages/error-page/404.vue'),
    meta: { hidden: true },
  },
  {
    path: '*',
    redirect: '/404',
  },
];

const router = new VueRouter({
  base: process.env.HISTORY_BASEURL,
  routes: [],
  mode: 'history',
});

Vue.use(VueRouter);

export default router;
export const asyncRoutes: RouteConfig[] = [
  {
    ...rootRoute,
    children: [
      customer,
      ...selfhelp,
      keyWords,
      relatedIssues,
      avatar,
      admin,
      returnsAndExchanges,
      ...refund,
      updatePhoneNumber,
      activity,
      sms,
      jdRights,
      blackList,
      ...invoice,
      creditStats
    ]
  },
];

export function mergeRoutes(...routes: RouteConfig[][]) {
  const cache = new Map<string, RouteConfig>();

  routes.forEach((routes) => {
    routes.forEach((route) => {
      const newRoute = { ...route };
      const { path, children } = newRoute;
      const cacheRoute = cache.get(path);
      cache.set(path, newRoute);
      newRoute.children = mergeRoutes(
        cacheRoute?.children || [],
        children || []
      );
    });
  });

  return [...cache.values()];
}
