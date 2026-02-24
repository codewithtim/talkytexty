interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-[38px] h-[22px] bg-[#e5e5e7] dark:bg-[#4a4a4a] rounded-full peer-checked:bg-[#34c759] dark:peer-checked:bg-[#30d158] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:shadow-sm after:transition-all peer-checked:after:translate-x-[16px]" />
    </label>
  );
}
