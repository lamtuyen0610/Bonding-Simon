import { describe, it, expect } from "vitest";
import { normalizeAnswer } from "../src/utils/normalize";

describe("normalizeAnswer", () => {
  it("chuẩn hóa các biến thể của P5 về cùng một giá trị", () => {
    const values = ["P5", "p5", " P5 ", "  p5  ", "P 5".replace(" ", "")];
    const normalized = values.map(normalizeAnswer);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("p5");
  });

  it("gộp nhiều khoảng trắng liên tiếp thành một", () => {
    expect(normalizeAnswer("Nguyễn   Văn   A")).toBe("nguyễn văn a");
  });
});
