import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";
import * as demoStyles from "./StorybookDemo.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className={demoStyles.fixedPanelWidth}>
      <TabsList>
        <TabsTrigger value="account">账户</TabsTrigger>
        <TabsTrigger value="password">密码</TabsTrigger>
        <TabsTrigger value="settings">设置</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Card className={demoStyles.contentBlock}>
          <h3 className={demoStyles.title}>账户信息</h3>
          <p className={demoStyles.bodySmall}>管理您的账户信息和偏好设置。</p>
        </Card>
      </TabsContent>
      <TabsContent value="password">
        <Card className={demoStyles.contentBlock}>
          <h3 className={demoStyles.title}>修改密码</h3>
          <p className={demoStyles.bodySmall}>定期更换密码以保护账户安全。</p>
        </Card>
      </TabsContent>
      <TabsContent value="settings">
        <Card className={demoStyles.contentBlock}>
          <h3 className={demoStyles.title}>系统设置</h3>
          <p className={demoStyles.bodySmall}>配置应用的全局设置。</p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className={demoStyles.fixedPanelWidth}>
      <TabsList>
        <TabsTrigger value="tab1">可用</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          禁用
        </TabsTrigger>
        <TabsTrigger value="tab3">可用</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <Card className={demoStyles.contentBlock}>第一个标签页内容</Card>
      </TabsContent>
      <TabsContent value="tab2">
        <Card className={demoStyles.contentBlock}>第二个标签页内容</Card>
      </TabsContent>
      <TabsContent value="tab3">
        <Card className={demoStyles.contentBlock}>第三个标签页内容</Card>
      </TabsContent>
    </Tabs>
  ),
};

export const VerticalManual: Story = {
  render: () => (
    <Tabs
      defaultValue="coverage"
      orientation="vertical"
      activationMode="manual"
      className={demoStyles.fixedWidePanelWidth}
    >
      <TabsList>
        <TabsTrigger value="coverage">Coverage matrix</TabsTrigger>
        <TabsTrigger value="boundaries">Boundary cases</TabsTrigger>
        <TabsTrigger value="runtime">Runtime parity</TabsTrigger>
      </TabsList>
      <TabsContent value="coverage">
        <Card className={demoStyles.contentBlock}>
          <h3 className={demoStyles.title}>Coverage matrix</h3>
          <p className={demoStyles.bodySmall}>
            Verify variants, sizes, themes, slots, and primary states without relying on
            hand-crafted shell wrappers.
          </p>
        </Card>
      </TabsContent>
      <TabsContent value="boundaries">
        <Card className={demoStyles.contentBlock}>
          <h3 className={demoStyles.title}>Boundary cases</h3>
          <p className={demoStyles.bodySmall}>
            Long labels, empty states, overflow, and nested compositions should remain legible when
            tabs are arranged vertically.
          </p>
        </Card>
      </TabsContent>
      <TabsContent value="runtime">
        <Card className={demoStyles.contentBlock}>
          <h3 className={demoStyles.title}>Runtime parity</h3>
          <p className={demoStyles.bodySmall}>
            Real host shells must preserve tab focus order and panel switching behavior under
            provider-backed themes.
          </p>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};
