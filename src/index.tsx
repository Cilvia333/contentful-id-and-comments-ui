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

interface IdAndComment {
  id: number | null;
  /** Markdown */
  comment: string;
}

const keySymbol = Symbol("key");
type Ogp = {title:string; imageUrl: string;};
type IdAndCommentWithKey = IdAndComment & Ogp & { [keySymbol]: string };

interface Props {
  sdk: FieldExtensionSDK;
  setValue(items: IdAndComment[]): Promise<void>;
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

    const ogp = await metascraper(serviceUrl + value);
    targetClonedItem.imageUrl = ogp ? ogp.image : '';
    targetClonedItem.title = ogp ? ogp.title: `Can't find the item`;

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
      title: `Can't find the item`,
      imageUrl: '',
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
                <MarkdownEditor
                  isInitiallyDisabled={false}
                  sdk={sdk}
                  disabled={false}
                  initialValue={comment}
                  saveValueToSDK={(e: string) => handleChangeComment(e, key,)}
                />
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

  // Handler for external field value changes (e.g. when multiple authors are working on the same entry).
  // sdk.field.onValueChanged((value) => {
  //   setValue(value);
  // });

  const prev = sdk.field.getValue() as IdAndComment[] | null;
  const { service } = sdk.parameters.instance as any;

  let initialValue: IdAndCommentWithKey[];
  if (prev == null || prev.length === 0) {
    initialValue = [{
      [keySymbol]: uuidv4(),
      id: null,
      comment: "",
      title: `Can't find the item`,
      imageUrl: '',
    }];
  } else {
    initialValue = await Promise.all(prev.map(async (_value) => {
      const value = _value as IdAndCommentWithKey;
      value[keySymbol] = uuidv4();
      const ogp = await metascraper(service + value.id);
      value.imageUrl = ogp? ogp.image : '';
      value.title = ogp? ogp.title: `Can't find the item`;
      return value;
    }));
  }

  render(<App sdk={sdk} setValue={setValue} initialValue={initialValue} serviceUrl={service}/>, document.getElementById('root'));
});
