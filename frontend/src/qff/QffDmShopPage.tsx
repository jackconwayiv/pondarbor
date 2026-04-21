import {
  Box,
  Field,
  Flex,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import {
  dmCreateItem,
  dmCreateNpcShop,
  dmCreateNpcShopStockLine,
  dmDeleteNpcShopStockLine,
  dmFetchItems,
  dmFetchNpcShop,
  dmFetchNpcShopPicker,
  dmPatchNpcShop,
  dmPatchNpcShopStockLine,
  type DmItem,
  type DmNpcShopDetail,
  type DmNpcShopPickerRow,
  type DmNpcShopStockLine,
} from "./api";

function suggestSlugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseOptPositiveInt(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export default function QffDmShopPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [picker, setPicker] = useState<DmNpcShopPickerRow[]>([]);
  const [npcId, setNpcId] = useState<number | "">("");
  const [shop, setShop] = useState<DmNpcShopDetail | null>(null);
  const [items, setItems] = useState<DmItem[]>([]);
  const [welcomeText, setWelcomeText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [sellPct, setSellPct] = useState(50);
  const [newLine, setNewLine] = useState({
    item_id: "",
    price: "10",
    quantity: "",
    sort_order: "0",
  });
  const [quickSlug, setQuickSlug] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickCost, setQuickCost] = useState("0");
  const [quickBusy, setQuickBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadPicker = useCallback(async () => {
    const token = await getApiAccessToken();
    const rows = await dmFetchNpcShopPicker(token);
    setPicker(rows);
  }, [getApiAccessToken]);

  const loadItems = useCallback(async () => {
    const token = await getApiAccessToken();
    const rows = await dmFetchItems(token);
    setItems(rows.sort((a, b) => a.name.localeCompare(b.name)));
  }, [getApiAccessToken]);

  const quickAddItem = async () => {
    const slug = quickSlug.trim();
    const name = quickName.trim();
    if (!slug || !name) {
      setErr("Quick add: slug and display name are required.");
      return;
    }
    setErr(null);
    setQuickBusy(true);
    try {
      const token = await getApiAccessToken();
      const cost = Math.max(0, parseInt(quickCost, 10) || 0);
      const created = await dmCreateItem(token, {
        slug,
        name,
        cost,
      });
      await loadItems();
      setNewLine((n) => ({
        ...n,
        item_id: String(created.id),
        price: String(Math.max(1, created.cost || 1)),
      }));
      setQuickName("");
      setQuickSlug("");
      setQuickCost("0");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Quick add failed");
    } finally {
      setQuickBusy(false);
    }
  };

  const loadShop = useCallback(
    async (id: number) => {
      const token = await getApiAccessToken();
      const s = await dmFetchNpcShop(token, id);
      setShop(s);
      if (s) {
        setWelcomeText(s.welcome_text ?? "");
        setEnabled(s.enabled);
        setSellPct(s.sell_price_percent);
      }
    },
    [getApiAccessToken],
  );

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    loadPicker().catch((e) => setErr(String(e)));
    loadItems().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, loadPicker, loadItems]);

  useEffect(() => {
    if (npcId === "") {
      setShop(null);
      return;
    }
    loadShop(npcId).catch((e) => setErr(String(e)));
  }, [npcId, loadShop]);

  const createShop = async () => {
    if (npcId === "") return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const s = await dmCreateNpcShop(token, npcId, {
        welcome_text: welcomeText,
        enabled,
        sell_price_percent: sellPct,
      });
      setShop(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    }
  };

  const saveShop = async () => {
    if (npcId === "" || !shop) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const s = await dmPatchNpcShop(token, npcId, {
        welcome_text: welcomeText,
        enabled,
        sell_price_percent: sellPct,
      });
      setShop(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const addStockLine = async () => {
    if (npcId === "" || !shop) return;
    const iid = parseInt(newLine.item_id, 10);
    if (!Number.isFinite(iid)) {
      setErr("Pick an item template.");
      return;
    }
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const qtyRaw = newLine.quantity.trim();
      const quantity =
        qtyRaw === "" || qtyRaw.toLowerCase() === "unlimited" ? null : parseOptPositiveInt(qtyRaw);
      if (qtyRaw !== "" && qtyRaw.toLowerCase() !== "unlimited" && quantity == null) {
        setErr("Quantity must be empty (unlimited) or a positive integer.");
        return;
      }
      await dmCreateNpcShopStockLine(token, npcId, {
        item_id: iid,
        price: Math.max(1, parseInt(newLine.price, 10) || 1),
        quantity,
        sort_order: Math.max(0, parseInt(newLine.sort_order, 10) || 0),
      });
      await loadShop(npcId);
      setNewLine({ item_id: "", price: "10", quantity: "", sort_order: "0" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add line failed");
    }
  };

  const patchLine = async (line: DmNpcShopStockLine, patch: Partial<DmNpcShopStockLine>) => {
    if (npcId === "") return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmPatchNpcShopStockLine(token, line.id, patch);
      await loadShop(npcId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    }
  };

  const deleteLine = async (line: DmNpcShopStockLine) => {
    if (!window.confirm("Remove this stock line?")) return;
    if (npcId === "") return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmDeleteNpcShopStockLine(token, line.id);
      await loadShop(npcId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (isLoading) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  const selectedNpc = picker.find((p) => p.id === npcId);

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Heading size="lg">NPC shops</Heading>
        <QffButton type="button" onClick={() => navigate("/qff/dm")}>
          DM home
        </QffButton>
      </Flex>
      <Text mb={4} color="#889977" fontSize="sm">
        Attach a shop to an NPC, set welcome text and static stock. Consignment rows from player sales
        appear here but can only be removed (not edited).
      </Text>
      {err && (
        <Text color="nautical.solid" mb={2} role="alert">
          {err}
        </Text>
      )}
      <Box borderWidth="1px" borderColor="#444" borderRadius="md" p={4} mb={6} bg="#1a1f16">
        <Heading size="sm" mb={1}>
          Quick add item template
        </Heading>
        <Text fontSize="sm" color="#889977" mb={3}>
          Create a minimal item (slug + name) so you can stock it immediately. Tune stats, slot, lore, and
          effects later in{" "}
          <Box
            as="button"
            color="#a8c896"
            textDecoration="underline"
            cursor="pointer"
            bg="transparent"
            border="none"
            p={0}
            font="inherit"
            onClick={() => navigate("/qff/dm/items")}
          >
            Item templates
          </Box>
          .
        </Text>
        <Flex gap={2} flexWrap="wrap" align="flex-end">
          <Field.Root minW="140px">
            <Field.Label>Slug</Field.Label>
            <Input
              value={quickSlug}
              onChange={(e) => setQuickSlug(e.target.value)}
              onBlur={() => {
                if (!quickSlug.trim() && quickName.trim()) {
                  setQuickSlug(suggestSlugFromName(quickName));
                }
              }}
              placeholder="e.g. red-potion"
              bg="#222"
            />
          </Field.Root>
          <Field.Root minW="180px">
            <Field.Label>Display name</Field.Label>
            <Input
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              onBlur={() => {
                if (!quickSlug.trim() && quickName.trim()) {
                  setQuickSlug(suggestSlugFromName(quickName));
                }
              }}
              placeholder="e.g. Red Potion"
              bg="#222"
            />
          </Field.Root>
          <Field.Root minW="100px">
            <Field.Label>Base cost (gold)</Field.Label>
            <Input
              type="number"
              min={0}
              value={quickCost}
              onChange={(e) => setQuickCost(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <QffButton type="button" disabled={quickBusy} onClick={() => void quickAddItem()}>
            {quickBusy ? "Creating…" : "Create item"}
          </QffButton>
        </Flex>
      </Box>
      <Stack gap={4}>
        <Field.Root maxW="lg">
          <Field.Label>NPC</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              value={npcId === "" ? "" : String(npcId)}
              onChange={(e) => {
                const v = e.target.value;
                setNpcId(v === "" ? "" : Number(v));
              }}
              bg="#222"
            >
              <option value="">— choose —</option>
              {picker.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.area_name} — {p.room_name} — {p.name}
                  {p.has_shop ? " (has shop)" : ""}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>

        {npcId !== "" && !shop && (
          <Box>
            <Text mb={2}>No shop yet for {selectedNpc?.name ?? "this NPC"}.</Text>
            <QffButton type="button" onClick={() => void createShop()}>
              Create shop
            </QffButton>
          </Box>
        )}

        {npcId !== "" && shop && (
          <>
            <Field.Root>
              <Field.Label>Welcome text</Field.Label>
              <Textarea
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                rows={3}
                bg="#222"
              />
            </Field.Root>
            <Flex gap={4} flexWrap="wrap">
              <Field.Root>
                <Field.Label>Enabled</Field.Label>
                <NativeSelectRoot>
                  <NativeSelectField
                    value={enabled ? "1" : "0"}
                    onChange={(e) => setEnabled(e.target.value === "1")}
                    bg="#222"
                    w="100px"
                  >
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field.Root>
              <Field.Root>
                <Field.Label>Sell price % of item cost</Field.Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={sellPct}
                  onChange={(e) => setSellPct(Number(e.target.value) || 50)}
                  bg="#222"
                  w="100px"
                />
              </Field.Root>
            </Flex>
            <QffButton type="button" onClick={() => void saveShop()}>
              Save shop settings
            </QffButton>

            <Heading size="md" mt={4}>
              Stock lines
            </Heading>
            <Stack gap={2}>
              {shop.stock_lines.map((line) => (
                <Flex
                  key={line.id}
                  gap={2}
                  flexWrap="wrap"
                  align="flex-end"
                  borderBottomWidth="1px"
                  borderColor="#333"
                  pb={2}
                >
                  <Text minW="200px" fontSize="sm" color="#c8e6a8">
                    {line.item_name}{" "}
                    <Box as="span" color="#889977">
                      ({line.kind}
                      {line.kind === "consignment"
                        ? ` · neglect ${line.times_shown_without_sale}`
                        : ""}
                      )
                    </Box>
                  </Text>
                  {line.kind === "static" ? (
                    <>
                      <Field.Root minW="80px">
                        <Field.Label>Price</Field.Label>
                        <Input
                          type="number"
                          min={1}
                          defaultValue={line.price}
                          key={`${line.id}-price-${line.price}`}
                          bg="#222"
                          onBlur={(e) => {
                            const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                            if (v !== line.price) void patchLine(line, { price: v });
                          }}
                        />
                      </Field.Root>
                      <Field.Root minW="90px">
                        <Field.Label>Qty (∞ empty)</Field.Label>
                        <Input
                          placeholder="∞"
                          defaultValue={
                            line.quantity == null ? "" : String(line.quantity)
                          }
                          key={`${line.id}-qty-${line.quantity}`}
                          bg="#222"
                          onBlur={(e) => {
                            const t = e.target.value.trim();
                            const quantity =
                              t === "" || t.toLowerCase() === "unlimited"
                                ? null
                                : parseOptPositiveInt(t);
                            if (t !== "" && t.toLowerCase() !== "unlimited" && quantity == null) {
                              return;
                            }
                            const same =
                              (line.quantity == null && quantity == null) ||
                              line.quantity === quantity;
                            if (!same) void patchLine(line, { quantity });
                          }}
                        />
                      </Field.Root>
                      <Field.Root minW="70px">
                        <Field.Label>Sort</Field.Label>
                        <Input
                          type="number"
                          min={0}
                          defaultValue={line.sort_order}
                          key={`${line.id}-sort-${line.sort_order}`}
                          bg="#222"
                          onBlur={(e) => {
                            const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                            if (v !== line.sort_order) void patchLine(line, { sort_order: v });
                          }}
                        />
                      </Field.Root>
                      <QffButton type="button" onClick={() => void deleteLine(line)}>
                        Remove
                      </QffButton>
                    </>
                  ) : (
                    <QffButton type="button" onClick={() => void deleteLine(line)}>
                      Remove consignment
                    </QffButton>
                  )}
                </Flex>
              ))}
            </Stack>

            <Heading size="sm" mt={4}>
              Add static line
            </Heading>
            <Flex gap={2} flexWrap="wrap" align="flex-end">
              <Field.Root minW="220px">
                <Field.Label>Item</Field.Label>
                <NativeSelectRoot>
                  <NativeSelectField
                    value={newLine.item_id}
                    onChange={(e) => {
                      const itemId = e.target.value;
                      const chosen = items.find(
                        (it) => String(it.id) === itemId,
                      );
                      setNewLine((n) => ({
                        ...n,
                        item_id: itemId,
                        price: chosen
                          ? String(Math.max(1, chosen.cost || 1))
                          : n.price,
                      }));
                    }}
                    bg="#222"
                  >
                    <option value="">— item —</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field.Root>
              <Field.Root minW="80px">
                <Field.Label>Price</Field.Label>
                <Input
                  value={newLine.price}
                  onChange={(e) => setNewLine((n) => ({ ...n, price: e.target.value }))}
                  bg="#222"
                />
              </Field.Root>
              <Field.Root minW="100px">
                <Field.Label>Qty (∞ empty)</Field.Label>
                <Input
                  placeholder="∞"
                  value={newLine.quantity}
                  onChange={(e) => setNewLine((n) => ({ ...n, quantity: e.target.value }))}
                  bg="#222"
                />
              </Field.Root>
              <Field.Root minW="70px">
                <Field.Label>Sort</Field.Label>
                <Input
                  value={newLine.sort_order}
                  onChange={(e) => setNewLine((n) => ({ ...n, sort_order: e.target.value }))}
                  bg="#222"
                />
              </Field.Root>
              <QffButton type="button" onClick={() => void addStockLine()}>
                Add line
              </QffButton>
            </Flex>
          </>
        )}
      </Stack>
    </Box>
  );
}
