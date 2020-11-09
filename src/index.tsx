import "@contentful/forma-36-react-components/dist/styles.css";
import "codemirror/lib/codemirror.css";
import "./index.css";

import React, { useCallback, useEffect, useLayoutEffect, useState, FC, FocusEvent, ChangeEvent, useRef } from "react";
import { render } from "react-dom";
import { v4 as uuidv4 } from "uuid";
import { Asset, Button, Form, TextInput, FormLabel } from "@contentful/forma-36-react-components";
import "./markdown/codemirrorImports";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import { init, FieldExtensionSDK } from "contentful-ui-extensions-sdk";
import metascraper from './lib/metascraper';

interface IdAndComment {
  id: number | null;
  /** Markdown */
  comment: string;
}

const keySymbol = Symbol("key");

interface Ogp {
  title: string;
  imageUrl: string;
}

type IdAndCommentWithKey = IdAndComment & { [keySymbol]: string };

interface Props {
  sdk: FieldExtensionSDK;
  setValue(items: IdAndComment[]): Promise<void>;
  initialValue: IdAndCommentWithKey[];
  serviceUrl: string;
}

export const App: FC<Props> = ({ sdk, setValue, initialValue, serviceUrl }) => {
  const [items, setItems] = useState<IdAndCommentWithKey[]>(initialValue);
  const [isDefaultLocale] = useState(sdk.field.locale === sdk.locales.default);

  const prevDefaultLocaleItems = useRef<IdAndComment[] | null>(null);

  useLayoutEffect(() => {
    sdk.window.startAutoResizer();
  });

  // default locale の値が変更されたときに ID を追随する
  useEffect(() => {
    if (isDefaultLocale) { return; }

    const currentEntryField = sdk.entry.fields[sdk.field.id];
    return currentEntryField.onValueChanged(sdk.locales.default, async (defaultLocaleItems: IdAndComment[]) => {
      if (prevDefaultLocaleItems.current === defaultLocaleItems) {
        return;
      }
      prevDefaultLocaleItems.current = defaultLocaleItems;

      const idToItem = new Map<number, IdAndCommentWithKey>();
      for (const item of items) {
        if (typeof item.id === "number") {
          idToItem.set(item.id, item);
        }
      }

      const newItems: IdAndCommentWithKey[] = [];
      for (const defaultLocaleItem of defaultLocaleItems) {
        if (defaultLocaleItem.id === null) { continue; }

        if (idToItem.has(defaultLocaleItem.id)) {
          newItems.push({
            ...idToItem.get(defaultLocaleItem.id)!,
          });
        } else {
          newItems.push({
            ...defaultLocaleItem,
            comment: "",
            [keySymbol]: uuidv4(),
          });
        }
      }

      setItems(newItems);
      await setValue(newItems);
    }) as () => void;
  }, [items, setValue]);

  const [ogps, setOgps] = useState<{ [key: number]: Ogp }>({});
  const ogpLoadings = useRef<{ [key: number]: boolean }>({});

  // OGP から画像を取得する
  useEffect(() => {
    for (const item of items) {
      if (item.id === null) { continue; }
      if (ogps[item.id] !== undefined) { continue; }
      if (ogpLoadings.current[item.id]) { continue; }

      (async () => {
        ogpLoadings.current[item.id!] = true;
        const ogp = await metascraper(serviceUrl + item.id!);
        ogpLoadings.current[item.id!] = false;
        ogps[item.id!] = {
          title: ogp?.title ?? "Can't find the item",
          imageUrl: ogp?.image ?? "",
        }
        setOgps({ ...ogps });
      })();
    }
  }, [items, ogps, serviceUrl]);

  const handleChangeId = useCallback(async (e: ChangeEvent<HTMLInputElement>, key: string) => {
    const target = e.currentTarget;
    const value = target.value !== "" ? Number.parseInt(target.value) : null;

    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItem = cloned.find((item) => item[keySymbol] === key)!;
    targetClonedItem.id = value;

    setItems(cloned);
    await setValue(cloned);
  }, [items, setValue]);

  const handleChangeComment = useCallback(async (value: string, key: string) => {
    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItem = cloned.find((item) => item[keySymbol] === key)!;
    targetClonedItem.comment = value;
    setItems(cloned);
    await setValue(cloned);
  }, [items, setValue]);

  const handleAddItem = useCallback(async (key: string) => {
    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItemIndex = cloned.findIndex((item) => item[keySymbol] === key)!;
    cloned.splice(targetClonedItemIndex + 1, 0, {
      [keySymbol]: uuidv4(),
      id: null,
      comment: "",
    });
    setItems(cloned);
    await setValue(cloned);
  }, [items]);

  const handleDeleteItem = useCallback(async (key: string) => {
    if (items.length == 1) {
      return;
    }

    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItemIndex = cloned.findIndex((item) => item[keySymbol] === key)!;
    cloned.splice(targetClonedItemIndex, 1);
    setItems(cloned);
    await setValue(cloned);
    }, [items]);

  // input[type=number] のスクロールによる値の変更を抑制する
  const preventWheelHandler = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  const handleFocusNumberInput = useCallback((e: FocusEvent<HTMLInputElement>) => {
    e.target.addEventListener("wheel", preventWheelHandler);
  }, [preventWheelHandler]);

  const handleBlurNumberInput = useCallback((e: FocusEvent<HTMLInputElement>) => {
    e.target.removeEventListener("wheel", preventWheelHandler);
  }, [preventWheelHandler]);

  return (
    <Form>
      {items.map(({ [keySymbol]: key, id, comment }) => {
        const ogp = id !== null ? ogps[id] : null;
        return <React.Fragment key={key}>
          <FormLabel htmlFor={key + "id"}>ID</FormLabel>
          <TextInput
            id={key + "id"}
            type="number"
            width="large"
            required={true}
            readOnly={!isDefaultLocale}
            min="1"
            value={id !== null ? id + "" : ""}
            onChange={(e) => handleChangeId(e, key)}
            onFocus={handleFocusNumberInput}
            onBlur={handleBlurNumberInput}
          />
          <Asset
            type="image"
            src={ogp?.imageUrl ?? ""}
            title={ogp?.title ?? "Loading"}
          />
          <details>
            <summary>コメント</summary>
                <MarkdownEditor
                  isInitiallyDisabled={false}
                  sdk={sdk}
                  disabled={false}
                  initialValue={comment}
                  saveValueToSDK={(e: string) => handleChangeComment(e, key,)}
                />
          </details>
          {isDefaultLocale && <>
            <Button icon="Plus" buttonType="muted" size="small" onClick={() => handleAddItem(key)} />
            <Button icon="Delete" buttonType="muted" size="small" onClick={() => handleDeleteItem(key)} />
          </>}
        </React.Fragment>;
      })}
    </Form>
  );
};

init<FieldExtensionSDK>(async (sdk) => {
  const setValue = async (items: IdAndComment[]) => {
    const idSet = new Set();
    let invalid = false;

    // validation
    for (const item of items) {
      if (item.id === null) {
        invalid = true;
      }

      if (idSet.has(item.id)) {
        invalid = true;
      }
      idSet.add(item.id);
    }

    sdk.field.setInvalid(invalid);
    await sdk.field.setValue(items);
  };

  const prev = sdk.field.getValue() as IdAndComment[] | null;
  const { service } = sdk.parameters.instance as any;

  let initialValue: IdAndCommentWithKey[];
  if (prev == null || prev.length === 0) {
    initialValue = [{
      [keySymbol]: uuidv4(),
      id: null,
      comment: "",
    }];
  } else {
    initialValue = prev.map((value) => {
      return {
        ...value,
        [keySymbol]: uuidv4(),
      };
    });
  }

  render(<App sdk={sdk} setValue={setValue} initialValue={initialValue} serviceUrl={service}/>, document.getElementById('root'));
});
