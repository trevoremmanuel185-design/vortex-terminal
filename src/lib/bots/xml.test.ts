import { describe, expect, it } from "vitest";
import { parseDbotXml } from "./xml";

const SUPPORTED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_definition" id="trade">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">1HZ75V</field>
      </block>
      <block type="trade_definition_contracttype">
        <field name="TYPE">DIGITOVER</field>
      </block>
      <block type="trade_definition_tradeoptions">
        <field name="DURATION">5</field>
        <field name="DURATIONTYPE">t</field>
        <field name="AMOUNT">1.5</field>
        <field name="PREDICTION">5</field>
      </block>
    </statement>
    <statement name="BEFORE_PURCHASE">
      <block type="purchase"></block>
    </statement>
    <statement name="AFTER_PURCHASE">
      <block type="trade_again"></block>
    </statement>
    <statement name="DURING_PURCHASE">
      <block type="trade_definition_restartonerror"></block>
    </statement>
  </block>
</xml>`;

const UNSUPPORTED_XML = `<?xml version="1.0"?>
<xml>
  <block type="trade_definition">
    <block type="trade_definition_contracttype"><field name="TYPE">CALL</field></block>
    <block type="trade_definition_tradeoptions">
      <field name="DURATION">5</field><field name="DURATIONTYPE">t</field><field name="AMOUNT">1</field>
    </block>
    <block type="purchase"></block>
    <block type="custom_super_secret_indicator"></block>
  </block>
</xml>`;

describe("parseDbotXml", () => {
  it("extracts trade parameters from a supported file", () => {
    const result = parseDbotXml(SUPPORTED_XML);
    expect(result.ok).toBe(true);
    expect(result.params.stake).toBe(1.5);
    expect(result.params.duration).toBe(5);
    expect(result.params.durationUnit).toBe("t");
    expect(result.params.contractType).toBe("DIGITOVER");
    expect(result.params.barrier).toBe("5");
    expect(result.market?.symbol).toBe("1HZ75V");
    expect(result.restartOnError).toBe(true);
    expect(result.unsupported).toHaveLength(0);
    expect(result.summary.join(" ")).toContain("DIGITOVER");
  });

  it("refuses partial conversions with unsupported blocks", () => {
    const result = parseDbotXml(UNSUPPORTED_XML);
    expect(result.ok).toBe(false);
    expect(result.unsupported).toContain("custom_super_secret_indicator");
    expect(result.errors.join(" ")).toMatch(/Refusing to run/);
  });

  it("rejects non-Blockly input", () => {
    const result = parseDbotXml("just some text");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/does not look like a Deriv DBot/);
  });

  it("rejects an empty file", () => {
    expect(parseDbotXml("").ok).toBe(false);
  });

  it("requires a purchase block", () => {
    const xml = SUPPORTED_XML.replace('<block type="purchase"></block>', "");
    const result = parseDbotXml(xml);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/purchase block/i);
  });
});
