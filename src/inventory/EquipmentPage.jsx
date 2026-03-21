// src/inventory/EquipmentPage.jsx
import React, { useEffect, useState } from "react";
import EquipmentGrid from "./EquipmentGrid";
import { INVENTORY_KEY } from "../constants/storage";
import { readJson, writeJson } from "../shared/storage/localStorage";

export default function EquipmentPage({ isDark }) {
  const [items, setItems] = useState(() => readJson(INVENTORY_KEY, []));

  useEffect(() => {
    writeJson(INVENTORY_KEY, items);
  }, [items]);

  return (
    <div className="w-full h-full overflow-auto p-3">
      <EquipmentGrid items={items} setItems={setItems} isDark={isDark} />
    </div>
  );
}
