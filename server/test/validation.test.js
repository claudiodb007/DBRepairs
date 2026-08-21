import test from "node:test";
import assert from "node:assert/strict";
import { customerInput, repairInput, ValidationError } from "../src/validation.js";

test("customer input trims values and converts empty fields to null", () => {
  assert.deepEqual(customerInput({ name: "  Ana  ", company: " " }), {
    name: "Ana", company: null, taxNumber: null, phone: null, email: null, address: null, notes: null,
  });
});

test("customer name is required", () => {
  assert.throws(() => customerInput({ name: " " }), ValidationError);
});

test("repair input validates identifiers and monetary values", () => {
  assert.throws(() => repairInput({ customer_id: 0, status_id: 1, reported_fault: "screen" }), ValidationError);
  assert.throws(() => repairInput({ customer_id: 1, status_id: 1, reported_fault: "screen", estimated_value: -1 }), ValidationError);
  assert.equal(repairInput({ customer_id: 1, status_id: 2, reported_fault: " screen ", estimated_value: "12.50" }).estimated_value, 12.5);
});
