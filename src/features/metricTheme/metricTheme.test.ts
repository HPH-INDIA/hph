import test from "node:test";
import assert from "node:assert/strict";
import type { AuthUser, RoleTypeCode } from "@/api/types";
import { canConfigureMetricTheme, defaultMetricTheme, validMetricTheme, metricThemeKey } from "./metricTheme";
const user = (roleType: RoleTypeCode, project: string | null, isActive = true) => ({isActive, project, role:{roleType}} as AuthUser);
test("only active coding managers see configuration", () => {
  assert.equal(canConfigureMetricTheme(user("manager","CODING")),true);
  for (const role of ["super_admin","admin","lead","employee"] as const) assert.equal(canConfigureMetricTheme(user(role,"CODING")),false);
  for (const project of [null,"RCM","OTHER"]) assert.equal(canConfigureMetricTheme(user("manager",project)),false);
  assert.equal(canConfigureMetricTheme(user("manager","CODING",false)),false);
  assert.equal(canConfigureMetricTheme(null),false);
});
test("stored themes require four safe complete color values", () => {
  assert.equal(validMetricTheme(defaultMetricTheme),true);
  for (const value of [null,{}, {...defaultMetricTheme,manual:"url(example)"},{...defaultMetricTheme,target:"red"}]) assert.equal(validMetricTheme(value),false);
});
test("preferences are namespaced per manager", () => assert.notEqual(metricThemeKey(1),metricThemeKey(2)));
