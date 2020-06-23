import "@contentful/forma-36-react-components/dist/styles.css";
import "codemirror/lib/codemirror.css";
import "./index.css";

import React, { useCallback, useState, FC, FocusEvent, ChangeEvent } from "react";
import { render } from "react-dom";
import { v4 as uuidv4 } from "uuid";
import { Asset, Button, Form, TextInput, FormLabel } from "@contentful/forma-36-react-components";
import "./markdown/codemirrorImports";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import { init, FieldExtensionSDK } from "contentful-ui-extensions-sdk";
import metascraper from './lib/metascraper';

type Locale = "ja" | "en" | "zh-Hans" | "zh-Hant";
const locales = ["ja", "en", "zh-Hans", "zh-Hant"] as const;

interface IdAndComment {
  id: number | null;
  /** Markdown */
  comment: Record<Locale, string>;
}

const keySymbol = Symbol("key");
type Ogp = {title:string; imageUrl: string;};
type IdAndCommentWithKey = IdAndComment & Ogp & { [keySymbol]: string };

interface Props {
  sdk: FieldExtensionSDK;
  setValueIfValid(items: IdAndComment[]): Promise<void>;
  initialValue: IdAndCommentWithKey[];
  serviceUrl: string;
}

export const App: FC<Props> = ({ sdk, setValueIfValid, initialValue, serviceUrl }) => {
  const [items, setItems] = useState<IdAndCommentWithKey[]>(initialValue);

  const handleChangeId = useCallback(async (e: ChangeEvent<HTMLInputElement>, key: string) => {
    const target = e.currentTarget;
    const value = target.value !== "" ? Number.parseInt(target.value) : null;

    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItem = cloned.find((item) => item[keySymbol] === key)!;
    targetClonedItem.id = value;
    const ogp = await metascraper(serviceUrl + value );
    targetClonedItem.imageUrl = ogp? ogp.image :'0';
    targetClonedItem.title = ogp? ogp.title: `Can't find the item`;
    setItems(cloned);
    await setValueIfValid(cloned);
  }, [items, setValueIfValid]);

  const handleChangeComment = useCallback(async (value: string, key: string, locale: Locale) => {
    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItem = cloned.find((item) => item[keySymbol] === key)!;
    targetClonedItem.comment[locale] = value;
    setItems(cloned);
    await setValueIfValid(cloned);
  }, [items, setValueIfValid]);

  const handleAddItem = useCallback((key: string) => {
    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItemIndex = cloned.findIndex((item) => item[keySymbol] === key)!;
    cloned.splice(targetClonedItemIndex + 1, 0, {
      [keySymbol]: uuidv4(),
      id: null,
      comment: {
        ja: "",
        en: "",
        "zh-Hans": "",
        "zh-Hant": "",
      },
      title: `Can't find the item`,
      imageUrl: '0',
    });
    setItems(cloned);
  }, [items]);

  const handleDeleteItem = useCallback((key: string) => {
    if (items.length == 1) {
      return;
    }

    const cloned = items.slice();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetClonedItemIndex = cloned.findIndex((item) => item[keySymbol] === key)!;
    cloned.splice(targetClonedItemIndex, 1);
    setItems(cloned);
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
      {items.map(({ [keySymbol]: key, id, comment, title, imageUrl }) => {
        return <React.Fragment key={key}>
          <FormLabel htmlFor={key + "id"}>ID</FormLabel>
          <TextInput
            id={key + "id"}
            type="number"
            width="large"
            required={true}
            min="1"
            value={id !== null ? id + "" : ""}
            onChange={(e) => handleChangeId(e, key)}
            onFocus={handleFocusNumberInput}
            onBlur={handleBlurNumberInput}
          />
          <Asset
            src={imageUrl}
            title={title}
          />
          <details>
            <summary>コメント</summary>
            {locales.map((locale) => {
              return <React.Fragment key={locale}>
                <span style={{ display: "inline-block", color: "#2a3039", fontSize: ".875rem", fontWeight: 600, marginTop: ".5rem", marginBottom: ".5rem" }}>{locale}</span>
                <MarkdownEditor
                  isInitiallyDisabled={false}
                  sdk={sdk}
                  disabled={false}
                  initialValue={comment[locale]}
                  saveValueToSDK={(e: string) => handleChangeComment(e, key, locale)}
                />
              </React.Fragment>;
            })}
          </details>
          <Button icon="Plus" buttonType="muted" size="small" onClick={() => handleAddItem(key)} />
          <Button icon="Delete" buttonType="muted" size="small" onClick={() => handleDeleteItem(key)} />
        </React.Fragment>;
      })}
    </Form>
  );
};

init<FieldExtensionSDK>(async (sdk) => {
  sdk.window.startAutoResizer();

  const setValueIfValid = async (items: IdAndComment[]) => {
    const idSet = new Set();

    // validation
    for (const item of items) {
      if (item.id === null) {
        sdk.field.setInvalid(true);
        return;
      }

      if (idSet.has(item.id)) {
        sdk.field.setInvalid(true);
        return;
      }
      idSet.add(item.id);
    }

    sdk.field.setInvalid(false);
    await sdk.field.setValue(items);
  };

  // Handler for external field value changes (e.g. when multiple authors are working on the same entry).
  // sdk.field.onValueChanged((value) => {
  //   setValue(value);
  // });

  const prev = sdk.field.getValue() as IdAndComment[] | null;
  const { service } = sdk.parameters.instance as any;
  console.log(service);

  let initialValue: IdAndCommentWithKey[];
  if (prev == null || prev.length === 0) {
    initialValue = [{
      [keySymbol]: uuidv4(),
      id: null,
      comment: {
        ja: "",
        en: "",
        "zh-Hans": "",
        "zh-Hant": "",
      },
      title: '',
      imageUrl: `Can't find the item`,
    }];
  } else {
    initialValue = await Promise.all(prev.map(async (_value) => {
      const value = _value as IdAndCommentWithKey;
      value[keySymbol] = uuidv4();
      const ogp = await metascraper(service + value.id );
      value.imageUrl = ogp? ogp.image :'0';
      value.title = ogp? ogp.title: `Can't find the item`;
      return value;
    }));
  }
  
  render(<App sdk={sdk} setValueIfValid={setValueIfValid} initialValue={initialValue} serviceUrl={service}/>, document.getElementById('root'));
});
