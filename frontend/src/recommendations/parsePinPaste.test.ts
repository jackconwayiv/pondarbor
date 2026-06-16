import { describe, expect, it } from "vitest";
import { looksLikeMapsLink, parsePinPaste, parsePlacePaste } from "./parsePinPaste";

describe("parsePinPaste", () => {
  it("parses comma-separated coordinates", () => {
    expect(parsePinPaste("33.4484, -112.0740")).toEqual({ lat: 33.4484, lng: -112.074 });
  });

  it("parses space-separated coordinates", () => {
    expect(parsePinPaste("33.4484 -112.0740")).toEqual({ lat: 33.4484, lng: -112.074 });
  });

  it("parses geo URI", () => {
    expect(parsePinPaste("geo:33.4484,-112.0740")).toEqual({ lat: 33.4484, lng: -112.074 });
  });

  it("parses Google Maps @ coordinates", () => {
    expect(
      parsePinPaste("https://www.google.com/maps/place/Coffee/@33.44840,-112.07400,17z"),
    ).toEqual({ lat: 33.4484, lng: -112.074, label: "Coffee" });
  });

  it("prefers place pin coords in data blob over viewport @", () => {
    expect(
      parsePinPaste(
        "https://www.google.com/maps/@33.48582,-112.06910,12z/data=!8m2!3d33.448373!4d-112.074037",
      ),
    ).toEqual({ lat: 33.448373, lng: -112.074037 });
  });

  it("prefers place segment @ over leading viewport @", () => {
    expect(
      parsePinPaste(
        "https://www.google.com/maps/place/China+Chili/@33.48582,-112.06910,17z/data=!8m2!3d33.448373!4d-112.074037",
      ),
    ).toEqual({ lat: 33.448373, lng: -112.074037, label: "China Chili" });
  });

  it("parses Apple Maps ll parameter", () => {
    expect(parsePinPaste("https://maps.apple.com/?ll=33.4918%2C-112.0256")).toEqual({
      lat: 33.4918,
      lng: -112.0256,
    });
  });

  it("returns null for invalid input", () => {
    expect(parsePinPaste("not coordinates")).toBeNull();
    expect(parsePinPaste("999, 999")).toBeNull();
  });
});

describe("looksLikeMapsLink", () => {
  it("detects maps URLs", () => {
    expect(looksLikeMapsLink("https://maps.apple.com/?ll=1,2")).toBe(true);
    expect(looksLikeMapsLink("https://maps.app.goo.gl/abc")).toBe(true);
    expect(looksLikeMapsLink("hello")).toBe(false);
  });
});

describe("parsePlacePaste", () => {
  it("parses business name and address", () => {
    expect(
      parsePlacePaste(
        "Desert Cave Mexican Food, 37611 N Cave Creek Rd, Cave Creek, AZ 85331",
      ),
    ).toEqual({
      title: "Desert Cave Mexican Food",
      address: "37611 N Cave Creek Rd, Cave Creek, AZ 85331",
    });
  });

  it("returns null for coordinates", () => {
    expect(parsePlacePaste("33.4484, -112.0740")).toBeNull();
  });
});
