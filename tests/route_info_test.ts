import { Transition } from 'router';
import { Dict } from 'router/core';
import RouteInfo, {
  ResolvedRouteInfo,
  Route,
  toReadOnlyRouteInfo,
  UnresolvedRouteInfoByObject,
  UnresolvedRouteInfoByParam,
} from 'router/route-info';
import InternalTransition from 'router/transition';
import URLTransitionIntent from 'router/transition-intent/url-transition-intent';
import { resolve } from 'rsvp';
import { createHandler, createHandlerInfo, module, test, TestRouter } from './test_helpers';

module('RouteInfo');

test('ResolvedRouteInfo resolve to themselves', function (assert) {
  let router = new TestRouter();
  let routeInfo = new ResolvedRouteInfo(router, 'foo', [], {}, createHandler('empty'));
  let intent = new URLTransitionIntent(router, 'foo');

  let transition = new InternalTransition(router, intent, undefined);

  routeInfo.resolve(transition).then(function (resolvedRouteInfo) {
    assert.equal(routeInfo, resolvedRouteInfo);
  });
});

test('UnresolvedRouteInfoByParam defaults params to {}', function (assert) {
  let router = new TestRouter();
  let routeInfo = new UnresolvedRouteInfoByParam(router, 'empty', [], {});
  assert.deepEqual(routeInfo.params, {});

  let routeInfo2 = new UnresolvedRouteInfoByParam(router, 'empty', [], { foo: 5 });
  assert.deepEqual(routeInfo2.params, { foo: 5 });
});

test('RouteInfo can be aborted mid-resolve', function (assert) {
  assert.expect(1);

  let routeInfo = createHandlerInfo('stub');

  let transition = {} as Transition;
  transition.isAborted = true;

  routeInfo.resolve(transition).catch(function (error: Error) {
    assert.equal(error, 'LOL');
  });
});

test('RouteInfo#resolve resolves with a ResolvedRouteInfo', function (assert) {
  assert.expect(1);

  let routeInfo = createHandlerInfo('stub');
  routeInfo.resolve({} as Transition).then(function (resolvedRouteInfo: RouteInfo<Route>) {
    assert.ok(resolvedRouteInfo instanceof ResolvedRouteInfo);
  });
});

test('RouteInfo#resolve runs beforeModel hook on handler', function (assert) {
  assert.expect(1);

  let transition = {} as Transition;

  let routeInfo = createHandlerInfo('stub', {
    route: createHandler('stub', {
      beforeModel: function (currentTransition: Transition) {
        assert.equal(
          transition,
          currentTransition,
          'beforeModel was called with the payload we passed to resolve()'
        );
      },
    }),
  });

  routeInfo.resolve(transition);
});

test('RouteInfo#resolve runs getModel hook', function (assert) {
  assert.expect(1);

  let transition = {} as Transition;

  let routeInfo = createHandlerInfo('stub', {
    getModel(payload: Dict<unknown>) {
      assert.equal(payload, transition);
    },
  });

  routeInfo.resolve(transition);
});

test('RouteInfo#resolve runs afterModel hook on handler', function (assert) {
  assert.expect(3);

  let transition = {} as Transition;
  let model = {};

  let routeInfo = createHandlerInfo('foo', {
    route: createHandler('foo', {
      afterModel: function (resolvedModel: Dict<unknown>, payload: Dict<unknown>) {
        assert.equal(resolvedModel, model, 'afterModel receives the value resolved by model');
        assert.equal(payload, transition);
        return resolve(123); // 123 should get ignored
      },
    }),
    getModel: function () {
      return resolve(model);
    },
  });

  routeInfo.resolve(transition).then(function (resolvedRouteInfo: RouteInfo<Route>) {
    assert.equal(resolvedRouteInfo.context, model, 'RouteInfo resolved with correct model');
  });
});

test('UnresolvedRouteInfoByParam gets its model hook called', function (assert) {
  assert.expect(2);
  let router = new TestRouter();

  let transition = {} as Transition;

  let routeInfo = new UnresolvedRouteInfoByParam(
    router,
    'empty',
    [],
    { first_name: 'Alex', last_name: 'Matchnerd' },
    createHandler('h', {
      model: function (params: Dict<unknown>, payload: Dict<unknown>) {
        assert.equal(payload, transition);
        assert.deepEqual(params, {
          first_name: 'Alex',
          last_name: 'Matchnerd',
        });
      },
    })
  );

  routeInfo.resolve(transition);
});

test('UnresolvedRouteInfoByObject does NOT get its model hook called', function (assert) {
  assert.expect(1);

  class TestRouteInfo extends UnresolvedRouteInfoByObject<Route> {
    route = createHandler('uresolved', {
      model: function () {
        assert.ok(false, "I shouldn't be called because I already have a context/model");
      },
    });
  }
  let routeInfo = new TestRouteInfo(
    new TestRouter(),
    'unresolved',
    ['wat'],
    resolve({ name: 'dorkletons' })
  );

  routeInfo.resolve({} as Transition).then(function (resolvedRouteInfo: RouteInfo<Route>) {
    // @ts-ignore
    assert.equal(resolvedRouteInfo.context!.name, 'dorkletons');
  });
});

test('RouteInfo.find', function (assert) {
  assert.expect(3);
  let router = new TestRouter();
  let parent = new ResolvedRouteInfo(router, 'parent', [], {}, createHandler('parent'));
  let child = new ResolvedRouteInfo(router, 'child', [], {}, createHandler('child'));
  let grandChild = new ResolvedRouteInfo(router, 'grandChild', [], {}, createHandler('grandChild'));
  let [root] = toReadOnlyRouteInfo([parent, child, grandChild]);

  enum RouteInfoNames {
    parent,
    child,
    grandChild,
  }

  root.find((routInfo, i) => {
    assert.equal(RouteInfoNames[i], routInfo.name);
    return false;
  });
});

test('RouteInfo.find returns matched', function (assert) {
  assert.expect(3);
  let router = new TestRouter();
  let parent = new ResolvedRouteInfo(router, 'parent', [], {}, createHandler('parent'));
  let child = new ResolvedRouteInfo(router, 'child', [], {}, createHandler('child'));
  let grandChild = new ResolvedRouteInfo(router, 'grandChild', [], {}, createHandler('grandChild'));
  let [root] = toReadOnlyRouteInfo([parent, child, grandChild]);

  enum RouteInfoNames {
    parent,
    child,
    grandChild,
  }

  let childInfo = root.find((routInfo, i) => {
    assert.equal(RouteInfoNames[i], routInfo.name);
    return routInfo.name === 'child';
  });
  assert.equal(childInfo!.name, 'child');
});
