import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { EventLog } from '../components/EventLog';
import { Field } from '../components/Field';
import { OptionSheet } from '../components/OptionSheet';
import { PrefillCard } from '../components/PrefillCard';
import { QuoteCard } from '../components/QuoteCard';
import { Segmented } from '../components/Segmented';
import { StatusBox } from '../components/StatusBox';
import { SwitchRow } from '../components/SwitchRow';
import { Tile, TileRow } from '../components/Tile';
import { DEFAULT_PREFILL, buildPrefill, type PrefillForm } from '../checkout/prefill';
import {
  DEFAULT_BUY_FORM,
  buildCheckoutRequest,
  parseAmount,
  selectCountry,
  selectCrypto,
  type BuyForm,
} from '../checkout/request';
import {
  COUNTRIES,
  CRYPTOS,
  FIATS,
  ONRAMPS,
  PAYMENT_METHODS,
  US_STATES,
  findCrypto,
  type CountryId,
  type Fiat,
} from '../config/catalog';
import { environmentLabel, type AppEnvironment } from '../config/environments';
import { useCheckout } from '../hooks/useCheckout';
import { TYPING_DEBOUNCE_MS, useDebouncedField } from '../hooks/useDebounce';
import type { OnramperHandle } from '../hooks/useOnramper';
import { RADIUS, useTheme, withAlpha } from '../theme';
import { describeError } from '../utils/format';

const FIAT_OPTIONS = FIATS.map(f => ({ value: f, label: f.toUpperCase() }));
const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ value: c.id, label: `${c.flag} ${c.label}` }));
const STATE_OPTIONS = US_STATES.map(s => ({ value: s.code, label: `${s.name} (${s.code})` }));

export function BuyCryptoScreen({
  onramper,
  environment,
  onOpenSettings,
}: {
  onramper: OnramperHandle;
  environment: AppEnvironment;
  onOpenSettings: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<BuyForm>(DEFAULT_BUY_FORM);
  const [prefillForm, setPrefillForm] = useState<PrefillForm>(DEFAULT_PREFILL);
  const [stateSheetOpen, setStateSheetOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [amountDraft, setAmountDraft] = useDebouncedField(form.amount, v => setForm(f => ({ ...f, amount: v })));
  const [walletDraft, setWalletDraft] = useDebouncedField(form.wallet, v => setForm(f => ({ ...f, wallet: v })));
  // Text edits settle after the typing debounce; the two switches settle immediately.
  const [settledPrefill, setSettledPrefill] = useState<PrefillForm>(prefillForm);
  useEffect(() => {
    const id = setTimeout(() => setSettledPrefill(prefillForm), TYPING_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [prefillForm]);
  const changePrefill = (next: PrefillForm) => {
    setPrefillForm(next);
    if (next.enabled !== prefillForm.enabled || next.sendEmail !== prefillForm.sendEmail) {
      setSettledPrefill(next);
    }
  };

  const request = useMemo(() => buildCheckoutRequest(form), [form]);
  const prefill = useMemo(() => buildPrefill(settledPrefill), [settledPrefill]);
  const buttonStyle = useMemo(
    () => ({ backgroundColor: t.accent, foregroundColor: t.onAccent, borderRadius: RADIUS.button }),
    [t],
  );
  const checkout = useCheckout({
    client: onramper.client,
    request,
    prefill,
    buttonStyle,
    onLog: onramper.appendLog,
  });

  const crypto = findCrypto(form.cryptoId);
  const amountHint =
    parseAmount(amountDraft) === null ? 'Enter an amount greater than 0' : checkout.amountHint ?? undefined;
  const update = (patch: Partial<BuyForm>) => setForm(f => ({ ...f, ...patch }));

  const runAction = async (label: string, action: (c: NonNullable<OnramperHandle['client']>) => Promise<void>) => {
    const c = onramper.client;
    if (!c) {
      return;
    }
    setActionError(null);
    try {
      await action(c);
      onramper.appendLog('info', `${label} OK`);
      checkout.refresh();
    } catch (e: unknown) {
      const { code, message } = describeError(e);
      setActionError(`${label} failed: ${code} — ${message}`);
      onramper.appendLog('error', `${label} failed: ${code} — ${message}`);
    }
  };

  const completed = onramper.sdkState === 'completed' || onramper.completedCheckoutId !== null;
  const errorBox = onramper.initError
    ? { title: 'SDK initialization failed', body: onramper.initError, actionLabel: 'Retry', onAction: onramper.retry }
    : checkout.error
    ? { title: 'Quote failed', body: checkout.error, actionLabel: 'Retry', onAction: checkout.refresh }
    : actionError
    ? { title: 'Action failed', body: actionError }
    : onramper.lastFailure
    ? { title: 'Checkout failed', body: onramper.lastFailure }
    : null;

  return (
    <View style={[styles.screen, { backgroundColor: t.contentBg }]}>
      <View style={[styles.header, { backgroundColor: t.headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: t.text }]}>Buy Crypto</Text>
        <View style={styles.headerRight}>
          {onramper.status === 'initializing' ? <ActivityIndicator color={t.accent} /> : null}
          <Text style={[styles.envBadge, { color: t.onAccent, backgroundColor: t.accent }]}>
            {environmentLabel(environment)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onOpenSettings} hitSlop={12}>
            <Text style={[styles.gear, { color: t.text }]}>⚙︎</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
        <Card>
          <SwitchRow
            label="Override country and state"
            value={form.countryOverride}
            onValueChange={v => update({ countryOverride: v })}
          />
          {form.countryOverride ? (
            <Segmented
              options={COUNTRY_OPTIONS}
              value={form.country}
              onChange={(id: CountryId) => setForm(f => selectCountry(f, id))}
            />
          ) : null}
          {form.countryOverride && form.country === 'us' ? (
            <Tile
              label={US_STATES.find(s => s.code === form.usState)?.name ?? form.usState}
              sublabel="US state — tap to change"
              selected={false}
              onPress={() => setStateSheetOpen(true)}
            />
          ) : null}
        </Card>

        <Card title="Select currency">
          <TileRow>
            {CRYPTOS.map(c => (
              <Tile
                key={c.id}
                label={c.symbol}
                sublabel={c.name}
                selected={c.id === form.cryptoId}
                onPress={() => setForm(f => selectCrypto(f, c.id))}
                leading={<View style={[styles.coin, { backgroundColor: c.color }]} />}
              />
            ))}
          </TileRow>
        </Card>

        <Card title={`Wallet address (${crypto.network})`}>
          <Field mono value={walletDraft} onChangeText={setWalletDraft} placeholder="Wallet address" />
        </Card>

        <Card title="Amount">
          <View style={styles.amountRow}>
            <View style={styles.amountInput}>
              <Field mono value={amountDraft} onChangeText={setAmountDraft} keyboardType="decimal-pad" />
            </View>
            <View style={styles.fiatPicker}>
              <Segmented options={FIAT_OPTIONS} value={form.fiat} onChange={(f: Fiat) => update({ fiat: f })} />
            </View>
          </View>
          {amountHint ? <Text style={{ color: t.danger }}>{amountHint}</Text> : null}
        </Card>

        <Card title="Payment method">
          <TileRow>
            {PAYMENT_METHODS.map(p => (
              <Tile
                key={p.id}
                label={p.label}
                selected={p.id === form.paymentMethod}
                onPress={() => update({ paymentMethod: p.id })}
              />
            ))}
          </TileRow>
        </Card>

        <Card title="Onramp">
          <TileRow>
            {ONRAMPS.map(o => (
              <Tile
                key={o.label}
                label={o.label}
                selected={o.value === form.onramp}
                onPress={() => update({ onramp: o.value })}
              />
            ))}
          </TileRow>
        </Card>

        <PrefillCard value={prefillForm} onChange={changePrefill} />

        {checkout.result && request ? (
          <>
            <QuoteCard quote={checkout.result.quote} amount={request.amount} fiat={form.fiat} cryptoSymbol={crypto.symbol} />
            {checkout.result.button}
          </>
        ) : checkout.loading || (request && onramper.status === 'initializing') ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : (
          <View style={[styles.placeholder, styles.disabledBuy, { backgroundColor: t.border }]}>
            <Text style={[styles.disabledBuyLabel, { color: t.textSecondary }]}>Buy</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={!onramper.client}
            onPress={() => runAction('reset', c => c.reset())}
            style={[styles.action, { backgroundColor: withAlpha(t.danger, 0.15) }]}>
            <Text style={[styles.actionLabel, { color: t.danger }]}>Reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!onramper.client}
            onPress={() => runAction('sign out', c => c.signOut())}
            style={[styles.action, { backgroundColor: withAlpha(t.warning, 0.15) }]}>
            <Text style={[styles.actionLabel, { color: t.warning }]}>Log out</Text>
          </Pressable>
        </View>

        <Text style={[styles.status, { color: t.textSecondary }]}>
          SDK: {onramper.status === 'ready' ? onramper.sdkState : onramper.status}
        </Text>
        {completed ? (
          <StatusBox
            tone="success"
            title="Transaction complete"
            body={onramper.transactionId ?? onramper.completedCheckoutId ?? undefined}
            selectableBody
          />
        ) : null}
        {!completed && onramper.transactionId ? (
          <StatusBox tone="success" title="Onramper transaction ID" body={onramper.transactionId} selectableBody />
        ) : null}
        {errorBox ? <StatusBox tone="error" {...errorBox} /> : null}

        <EventLog entries={onramper.log} onClear={onramper.clearLog} />
      </ScrollView>

      <OptionSheet
        visible={stateSheetOpen}
        title="US state"
        options={STATE_OPTIONS}
        selected={form.usState}
        onSelect={code => update({ usState: code })}
        onClose={() => setStateSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  envBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gear: { fontSize: 24 },
  content: { padding: 16, gap: 16 },
  coin: { width: 20, height: 20, borderRadius: 10 },
  amountRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  amountInput: { flex: 1 },
  fiatPicker: { width: 180 },
  placeholder: { height: 56, alignItems: 'center', justifyContent: 'center' },
  disabledBuy: { borderRadius: RADIUS.button },
  disabledBuyLabel: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, borderRadius: RADIUS.button, paddingVertical: 12, alignItems: 'center' },
  actionLabel: { fontSize: 15, fontWeight: '600' },
  status: { fontSize: 12, fontFamily: 'Menlo' },
});
