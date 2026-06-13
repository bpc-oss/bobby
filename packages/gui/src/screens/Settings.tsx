import React from 'react';

import { useUiStore } from '../store/ui-store';
import { getSettingsCopy, getSettingsGroups, type SettingsSectionKey } from './settings-sections';

type SettingTextRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function SettingTextRow({ label, value, onChange }: SettingTextRowProps): JSX.Element {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SettingSelectRow({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}): JSX.Element {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SandboxRow({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}): JSX.Element {
  return (
    <label className="settings-row">
      <span>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}
      </span>
    </label>
  );
}

function SettingsSummary({
  model,
  route,
  budgetUsd,
  defaultPermission,
  strongSandbox
}: {
  model: string;
  route: string;
  budgetUsd: string;
  defaultPermission: string;
  strongSandbox: boolean;
}): JSX.Element {
  return (
    <p className="muted">
      {`model=${model}, route=${route}, budget=${budgetUsd}, defaultPermission=${defaultPermission}, strongSandbox=${strongSandbox ? 'on' : 'off'}`}
    </p>
  );
}

export function Settings(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const setLang = useUiStore((state) => state.setLang);
  const copy = getSettingsCopy(lang);
  const groups = React.useMemo(() => getSettingsGroups(lang), [lang]);
  const [model, setModel] = React.useState('deepseek');
  const [route, setRoute] = React.useState('default');
  const [budgetUsd, setBudgetUsd] = React.useState('100');
  const [defaultPermission, setDefaultPermission] = React.useState('L1');
  const [strongSandbox, setStrongSandbox] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<SettingsSectionKey>('general');
  const [query, setQuery] = React.useState('');

  const allSections = React.useMemo(() => groups.flatMap((group) => group.sections), [groups]);
  const visibleGroups = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        sections: group.sections.filter((section) => section.label.toLowerCase().includes(normalized))
      }))
      .filter((group) => group.sections.length > 0);
  }, [groups, query]);

  const active = allSections.find((section) => section.key === activeSection) ?? allSections[0];

  React.useEffect(() => {
    if (visibleGroups.length === 0) {
      return;
    }

    const stillVisible = visibleGroups.some((group) => group.sections.some((section) => section.key === activeSection));
    if (!stillVisible) {
      setActiveSection(visibleGroups[0].sections[0].key);
    }
  }, [activeSection, visibleGroups]);

  return (
    <section className="settings-workspace">
      <aside className="settings-nav">
        <button className="settings-back" type="button">
          {copy.back}
        </button>
        <label className="settings-search">
          <span className="sr-only">{copy.search}</span>
          <input
            aria-label={copy.search}
            type="text"
            value={query}
            placeholder={copy.search}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="settings-nav-groups">
          {visibleGroups.map((group) => (
            <div key={group.key} className="settings-nav-group">
              <div className="settings-nav-title">{group.title}</div>
              {group.sections.map((section) => (
                <button
                  key={section.key}
                  className={`settings-nav-item ${section.key === active?.key ? 'active' : ''}`}
                  type="button"
                  aria-pressed={section.key === active?.key}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="settings-content">
        <h2 className="screen-title">{active?.label ?? copy.title}</h2>
        <p className="muted">{active?.description ?? copy.sectionNote}</p>

        {active?.key === 'general' ? (
          <div className="wizard-form">
            <SettingSelectRow
              label={copy.general.languageLabel}
              value={lang}
              onChange={(value) => setLang(value as 'zh' | 'en')}
              options={[
                { value: 'zh', label: copy.languages.zh },
                { value: 'en', label: copy.languages.en }
              ]}
            />
            <SettingTextRow label={copy.general.modelLabel} value={model} onChange={setModel} />
            <SettingTextRow label={copy.general.routeLabel} value={route} onChange={setRoute} />
            <SettingTextRow label={copy.general.budgetLabel} value={budgetUsd} onChange={setBudgetUsd} />
            <SettingSelectRow
              label={copy.general.permissionLabel}
              value={defaultPermission}
              onChange={setDefaultPermission}
              options={['L0', 'L1', 'L2', 'L3', 'L4'].map((value) => ({ value, label: value }))}
            />
            <SandboxRow checked={strongSandbox} onChange={setStrongSandbox} label={copy.general.sandboxLabel} />
            <p className="muted">{copy.sectionNote}</p>
            <SettingsSummary
              model={model}
              route={route}
              budgetUsd={budgetUsd}
              defaultPermission={defaultPermission}
              strongSandbox={strongSandbox}
            />
          </div>
        ) : (
          <div className="settings-panel-card">
            <p className="muted">{copy.notConnectedYet}</p>
          </div>
        )}
      </div>
    </section>
  );
}
