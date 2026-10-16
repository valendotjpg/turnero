import { describe, expect, it } from "vitest";
import { describeError } from "./errors";

describe("describeError", () => {
  it("usa el mensaje del error", () => {
    expect(describeError(new Error("SMTP caído"))).toBe("SMTP caído");
  });

  it("detalla un AggregateError sin mensaje, como el de una conexión rechazada", () => {
    const error = new AggregateError(
      [new Error("connect ECONNREFUSED ::1:1025"), new Error("connect ECONNREFUSED 127.0.0.1:1025")],
      "",
    );
    expect(describeError(error)).toBe("connect ECONNREFUSED ::1:1025 / connect ECONNREFUSED 127.0.0.1:1025");
  });

  it("si no hay mensaje, usa el código del error", () => {
    expect(describeError(Object.assign(new Error(""), { code: "ETIMEDOUT" }))).toBe("ETIMEDOUT");
  });

  it("acepta cualquier valor lanzado", () => {
    expect(describeError("texto")).toBe("texto");
  });
});
