declare module "*.vue" {
  const component: unknown;

  export default component;
}

declare module "*.css";

declare module "vue" {
  export interface Ref<T> {
    value: T;
  }

  export function ref<T>(value: T): Ref<T>;
  export function readonly<T>(value: T): Readonly<T>;
  export function onScopeDispose(effect: () => void): void;
  export function defineCustomElement(component: unknown): CustomElementConstructor;
}
