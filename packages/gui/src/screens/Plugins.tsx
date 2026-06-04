import React from 'react';

interface PluginState {
  name: string;
  enabled: boolean;
}

export function Plugins(): JSX.Element {
  const [plugins, setPlugins] = React.useState<PluginState[]>([
    { name: 'review', enabled: true },
    { name: 'code_style', enabled: false },
    { name: 'schema_guard', enabled: true }
  ]);

  const toggle = (name: string): void => {
    setPlugins((current) => current.map((item) => (item.name === name ? { ...item, enabled: !item.enabled } : item)));
  };

  return (
    <section className="wizard-form">
      <h2 className="screen-title">插件</h2>
      <p className="muted">启停验证和辅助能力插件。</p>
      <div className="plugin-list">
        {plugins.map((plugin) => (
          <article className="plugin-item" key={plugin.name}>
            <span>{plugin.name}</span>
            <button type="button" onClick={() => toggle(plugin.name)}>
              {plugin.enabled ? '停用' : '启用'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
