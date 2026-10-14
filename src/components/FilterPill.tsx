// Defender 대기열의 "Status: Any ×" 필터 알약. 누르면 체크 메뉴가 열리고, ×로 그 필터만 지운다.
import {
  Button,
  Menu,
  MenuItemCheckbox,
  MenuList,
  MenuPopover,
  MenuTrigger,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { ChevronDownRegular, DismissRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  pill: {
    display: "inline-flex",
    alignItems: "center",
    height: "28px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
  },
  active: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  main: {
    minWidth: 0,
    height: "28px",
    paddingLeft: "10px",
    paddingRight: "6px",
    fontWeight: tokens.fontWeightRegular,
    color: "inherit",
    ":hover": { color: "inherit" },
    ":hover:active": { color: "inherit" },
  },
  value: { fontWeight: tokens.fontWeightSemibold, marginLeft: "4px" },
  clear: {
    minWidth: "28px",
    height: "28px",
    color: "inherit",
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: 0,
    ":hover": { color: "inherit" },
  },
  count: { color: tokens.colorNeutralForeground3, marginLeft: "auto", paddingLeft: "16px" },
});

export interface PillOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  name: string;
  label: string;
  anyLabel: string;
  options: PillOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  clearLabel: string;
}

export function FilterPill({ name, label, anyLabel, options, selected, onChange, clearLabel }: Props) {
  const s = useStyles();
  const active = selected.length > 0;
  const shown = active
    ? selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${options.find((o) => o.value === selected[0])?.label ?? selected[0]} +${selected.length - 1}`
    : anyLabel;

  return (
    <span className={mergeClasses(s.pill, active && s.active)}>
      <Menu
        checkedValues={{ [name]: selected }}
        onCheckedValueChange={(_, d) => onChange(d.checkedItems)}
        positioning="below-start"
      >
        <MenuTrigger disableButtonEnhancement>
          <Button appearance="transparent" size="small" className={s.main} icon={<ChevronDownRegular />} iconPosition="after">
            {label}:<span className={s.value}>{shown}</span>
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {options.map((o) => (
              <MenuItemCheckbox key={o.value} name={name} value={o.value} disabled={!selected.includes(o.value) && o.count === 0}>
                <span style={{ display: "flex", width: "100%" }}>
                  {o.label}
                  {o.count !== undefined && <span className={s.count}>{o.count}</span>}
                </span>
              </MenuItemCheckbox>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
      {active && (
        <Button
          appearance="transparent"
          size="small"
          className={s.clear}
          icon={<DismissRegular />}
          aria-label={`${label} ${clearLabel}`}
          onClick={() => onChange([])}
        />
      )}
    </span>
  );
}
