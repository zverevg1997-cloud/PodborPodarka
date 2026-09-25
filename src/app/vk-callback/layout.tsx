import type { Metadata } from "next";

// Служебная страница: в поиске ей делать нечего, а в адресе, по которому на
// неё приходят, лежит одноразовый код.
export const metadata: Metadata = {
  title: "Вход выполнен",
  robots: { index: false, follow: false },
};

export default function VkCallbackLayout({
  children,
}: LayoutProps<"/vk-callback">) {
  return children;
}
