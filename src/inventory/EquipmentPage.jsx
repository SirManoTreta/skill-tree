// src/inventory/EquipmentPage.jsx
import React from "react";
import EquipmentGrid from "./EquipmentGrid";
import { useCharacter } from "../character/context";

export default function EquipmentPage({ isDark }) {
  const { profile: { items }, setItems } = useCharacter();

  return (
    <div className="w-full h-full overflow-auto p-3">
      <EquipmentGrid items={items} setItems={setItems} isDark={isDark} />
    </div>
  );
}
