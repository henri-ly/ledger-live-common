// @flow
import flatMap from "lodash/flatMap";
import { fromAccountRaw, groupAccountOperationsByDay } from "../../account";

const account = fromAccountRaw({
  id: "libcore:1:tezos:A:tezbox",
  seedIdentifier: "B",
  name: "Tezos 3",
  derivationMode: "tezbox",
  index: 2,
  freshAddress: "me",
  freshAddressPath: "44'/1729'/2'/0'",
  freshAddresses: [
    {
      address: "me",
      derivationPath: "44'/1729'/2'/0'"
    }
  ],
  blockHeight: 140408643618744,
  operations: [
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711602,
      hash: "one",
      id: "libcore:1:tezos:A:tezbox-one-OUT",
      recipients: ["other2"],
      senders: ["me"],
      type: "OUT",
      extra: {},
      date: "2019-11-27T15:29:27.000Z",
      value: "211000",
      fee: "11000"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711602,
      hash: "one",
      id: "libcore:1:tezos:A:tezbox-one-REVEAL",
      recipients: [""],
      senders: ["me"],
      type: "REVEAL",
      extra: {},
      date: "2019-11-27T15:29:27.000Z",
      value: "11000",
      fee: "11000"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711448,
      hash: "two",
      id: "libcore:1:tezos:A:tezbox-two-IN",
      recipients: ["me"],
      senders: ["other"],
      type: "IN",
      extra: {},
      date: "2019-11-27T12:52:07.000Z",
      value: "500000",
      fee: "259500"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711445,
      hash: "three",
      id: "libcore:1:tezos:A:tezbox-three-OUT",
      recipients: ["other"],
      senders: ["me"],
      type: "OUT",
      extra: {},
      date: "2019-11-27T12:49:07.000Z",
      value: "986580",
      fee: "13420"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711445,
      hash: "three",
      id: "libcore:1:tezos:A:tezbox-three-REVEAL",
      recipients: [""],
      senders: ["me"],
      type: "REVEAL",
      extra: {},
      date: "2019-11-27T12:49:07.000Z",
      value: "13420",
      fee: "13420"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711438,
      hash: "four",
      id: "libcore:1:tezos:A:tezbox-four-IN",
      recipients: ["me"],
      senders: ["other2"],
      type: "IN",
      extra: {},
      date: "2019-11-27T12:42:07.000Z",
      value: "1000000",
      fee: "262000"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711435,
      hash: "five",
      id: "libcore:1:tezos:A:tezbox-five-OUT",
      recipients: ["other3"],
      senders: ["me"],
      type: "OUT",
      extra: {},
      date: "2019-11-27T12:39:07.000Z",
      value: "949990",
      fee: "50010"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711435,
      hash: "five",
      id: "libcore:1:tezos:A:tezbox-five-REVEAL",
      recipients: [""],
      senders: ["me"],
      type: "REVEAL",
      extra: {},
      date: "2019-11-27T12:39:07.000Z",
      value: "50010",
      fee: "50010"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: 711433,
      hash: "six",
      id: "libcore:1:tezos:A:tezbox-six-IN",
      recipients: ["me"],
      senders: ["other3"],
      type: "IN",
      extra: {},
      date: "2019-11-27T12:37:07.000Z",
      value: "1000000",
      fee: "285160"
    }
  ],
  pendingOperations: [
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: null,
      hash: "one",
      id: "libcore:1:tezos:A:tezbox-one-OUT",
      recipients: ["other2"],
      senders: ["me"],
      type: "OUT",
      extra: {},
      date: "2019-11-27T15:29:03.215Z",
      value: "222000",
      fee: "22000"
    },
    {
      accountId: "libcore:1:tezos:A:tezbox",
      blockHash: null,
      blockHeight: null,
      hash: "seven",
      id: "libcore:1:tezos:A:tezbox-seven-OUT",
      recipients: ["other2"],
      senders: ["me"],
      type: "OUT",
      extra: {},
      date: "2019-11-27T15:30:07.689Z",
      value: "234420",
      fee: "34420"
    }
  ],
  currencyId: "tezos",
  unitMagnitude: 6,
  lastSyncDate: "2019-11-27T15:29:51.673Z",
  balance: "278000",
  spendableBalance: "278000",
  xpub: "A",
  subAccounts: []
});

test("pending operation are in order", () => {
  const byDay = groupAccountOperationsByDay(account, { count: 100 });
  expect(byDay.completed).toBe(true);

  const dates = flatMap(byDay.sections, s => s.data.map(o => o.date));
  const sortedByDates = dates.slice(0).sort((a, b) => b - a);
  expect(dates).toMatchObject(sortedByDates);

  expect(byDay.sections.map(s => s.data.map(o => o.id))).toMatchObject([
    [
      "libcore:1:tezos:A:tezbox-seven-OUT",
      "libcore:1:tezos:A:tezbox-one-OUT",
      "libcore:1:tezos:A:tezbox-one-REVEAL",
      "libcore:1:tezos:A:tezbox-two-IN",
      "libcore:1:tezos:A:tezbox-three-OUT",
      "libcore:1:tezos:A:tezbox-three-REVEAL",
      "libcore:1:tezos:A:tezbox-four-IN",
      "libcore:1:tezos:A:tezbox-five-OUT",
      "libcore:1:tezos:A:tezbox-five-REVEAL",
      "libcore:1:tezos:A:tezbox-six-IN"
    ]
  ]);
});
