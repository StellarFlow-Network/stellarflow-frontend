import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { OptimizedDialog, OptimizedDialogProps } from "./OptimizedDialog";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof OptimizedDialog> = {
  title: "UI/Modals/OptimizedDialog",
  component: OptimizedDialog,
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Controls whether the dialog is visible",
    },
    onClose: {
      action: "onClose",
      description: "Callback fired when the dialog requests to close",
    },
    title: {
      control: "text",
      description: "The dialog title displayed in the header",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
      description: "Controls the maximum width of the dialog",
    },
    closeOnBackdropClick: {
      control: "boolean",
      description: "Whether clicking the backdrop closes the dialog",
    },
    closeOnEscape: {
      control: "boolean",
      description: "Whether pressing ESC closes the dialog",
    },
    showCloseButton: {
      control: "boolean",
      description: "Whether to show the close button in the header",
    },
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: "color-contrast",
            reviewOnFail: true,
          },
        ],
      },
    },
    docs: {
      description: {
        component: "A performant, accessible dialog component with conditional rendering. It completely removes itself from the DOM when closed and includes keyboard navigation, focus management, and smooth animations.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof OptimizedDialog>;

// Interactive story that properly handles state
const InteractiveTemplate = (args: Omit<OptimizedDialogProps, "isOpen" | "onClose">) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
      <OptimizedDialog {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        {args.children}
      </OptimizedDialog>
    </div>
  );
};

export const Small: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "Small Dialog",
    size: "sm",
    children: (
      <p>This is a small dialog. It's perfect for simple confirmations or short messages.</p>
    ),
  },
};

export const Medium: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "Medium Dialog",
    size: "md",
    children: (
      <div className="space-y-4">
        <p>This is a medium-sized dialog, which is the default size. It works well for most use cases.</p>
        <p>You can put multiple paragraphs of content here, forms, or any other React components.</p>
      </div>
    ),
  },
};

export const Large: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "Large Dialog",
    size: "lg",
    children: (
      <div className="space-y-4">
        <p>This is a large dialog, suitable for more complex content that needs more horizontal space.</p>
        <p>You might use this size for detailed forms, data tables, or media that benefits from extra width.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-100 rounded">Column 1 content</div>
          <div className="p-4 bg-gray-100 rounded">Column 2 content</div>
        </div>
      </div>
    ),
  },
};

export const ExtraLarge: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "Extra Large Dialog",
    size: "xl",
    children: (
      <div className="space-y-4">
        <p>This is an extra-large dialog, perfect for complex interfaces that need maximum screen real estate.</p>
        <p>Use this size sparingly, as it takes up most of the viewport width on desktop screens.</p>
      </div>
    ),
  },
};

export const WithoutCloseButton: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "No Close Button",
    showCloseButton: false,
    children: (
      <p>This dialog doesn't have a close button in the header. You can still close it by clicking the backdrop or pressing ESC (unless those options are disabled).</p>
    ),
  },
};

export const PreventBackdropClose: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "Backdrop Click Disabled",
    closeOnBackdropClick: false,
    children: (
      <p>You can't close this dialog by clicking the backdrop. You must use the close button or press ESC (which is still enabled here).</p>
    ),
  },
};

export const PreventEscapeClose: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: "ESC Key Disabled",
    closeOnEscape: false,
    children: (
      <p>You can't close this dialog by pressing ESC. You must click the close button or the backdrop (which is still enabled here).</p>
    ),
  },
};

export const WithoutTitle: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: undefined,
    children: (
      <p>This dialog doesn't have a title. The accessibility attributes are still properly configured for screen readers.</p>
    ),
  },
};