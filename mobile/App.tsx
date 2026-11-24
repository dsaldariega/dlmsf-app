import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "./lib/supabase";
import { getMemberRole, type MemberRole } from "./lib/auth";
import { ThemeProvider, theme, useTheme } from "./theme";
import { apiRequest, ApiError } from "./lib/api";
import { currency, dateLabel, shortDate, statusTone, wholeCurrency } from "./lib/format";
import type { FiscalYear, FiscalYearSettings } from "./lib/fiscal";

type AuthenticatedUser = { id: string; email: string; role: MemberRole };
type Tab = "home" | "loans" | "payments" | "requests" | "audit" | "members" | "settings" | "fiscal" | "account";

type Dashboard = {
  member?: { id: number; name: string; heads: number; tier_code?: string | null };
  members?: Array<{ id: number; name: string; heads: number }>;
  payments: Array<{ id: number; week_start: string; amount: number }>;
  loans: Array<any>;
  loanPayments: Array<any>;
};

type LoanRequest = {
  id: number;
  member_id: number;
  amount: number;
  months: number;
  status: string;
  requested_at: string;
  reviewed_at?: string | null;
  admin_remarks?: string | null;
  member?: { name?: string } | null;
};

type PaymentSubmission = {
  id: number;
  member_id: number;
  payment_type: string;
  amount: number;
  paid_on?: string | null;
  week_start?: string | null;
  loan_id?: number | null;
  status: string;
  submitted_at: string;
  reviewed_at?: string | null;
  admin_remarks?: string | null;
  reference?: string | null;
  member?: { name?: string } | null;
  loan?: { id: number; total: number; monthly: number; months: number; status: string } | null;
};

type Member = { id: number; name: string; heads: number; auth_id?: string | null; roles?: string[] };
type AuditRecord = {
  id: number;
  synthetic?: boolean;
  member_id?: number;
  borrower_name?: string;
  amount?: number;
  interest?: number;
  total?: number;
  monthly?: number;
  week_start?: string | null;
  action?: string;
  remarks?: string | null;
  created_date?: string;
  actor_role?: string | null;
  loan_request_id?: number;
};

const BLUE = theme.colors.primary;
const DARK = theme.colors.text;
const SLATE = theme.colors.textSecondary;
const BORDER = theme.colors.border;
const BG = theme.colors.background;
const WHITE = theme.colors.white;
const GREEN = theme.colors.success;
const RED = theme.colors.danger;
const AMBER = theme.colors.warning;

type ToastVariant = "success" | "error" | "info";
type ToastState = { message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, variant: ToastVariant = "success") {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, variant });
  }

  useEffect(() => {
    if (!toast) return;

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 160, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 160, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, 2400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, opacity, translateY]);

  const palette = toast?.variant === "error"
    ? { backgroundColor: "#FEF2F2", borderColor: "#FECACA", iconBackground: "#FEE2E2", iconColor: RED, icon: "!" }
    : toast?.variant === "info"
      ? { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", iconBackground: "#DBEAFE", iconColor: BLUE, icon: "i" }
      : { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", iconBackground: "#DCFCE7", iconColor: GREEN, icon: "✓" };

  return (
    <ToastContext.Provider value={showToast}>
      <View style={styles.toastProvider}>
        {children}
        {toast ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toast,
              { opacity, transform: [{ translateY }], backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
            ]}
          >
            <View style={[styles.toastIcon, { backgroundColor: palette.iconBackground }]}>
              <Text style={[styles.toastIconText, { color: palette.iconColor }]}>{palette.icon}</Text>
            </View>
            <Text style={styles.toastMessage}>{toast.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used inside ToastProvider.");
  return showToast;
}

function AppContent() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mounted) setUser(null);
    });

    async function restoreSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) return;

        const { data: { user: authUser }, error: userError } =
          await supabase.auth.getUser(session.access_token);
        if (userError || !authUser) {
          await supabase.auth.signOut();
          return;
        }

        const role = await getMemberRole(authUser.id);
        if (mounted) setUser({ id: authUser.id, email: authUser.email ?? "", role });
      } catch (error) {
        if (mounted) setAuthError(error instanceof Error ? error.message : "Unable to restore your session.");
      } finally {
        if (mounted) setInitializing(false);
      }
    }

    void restoreSession();
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setAuthError("");
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    else setUser(null);
  }

  if (initializing) return <LoadingScreen />;
  if (!user) return <SignInScreen onSignedIn={setUser} error={authError} setError={setAuthError} />;

  return <AuthenticatedApp user={user} onSignOut={signOut} />;
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <StatusBar style="dark" />
      <View style={styles.brandMark}><Text style={styles.brandInitials}>DL</Text></View>
      <ActivityIndicator color={BLUE} />
      <Text style={styles.loadingText}>Preparing your account…</Text>
    </View>
  );
}

function SignInScreen({
  onSignedIn,
  error,
  setError,
}: {
  onSignedIn: (user: AuthenticatedUser) => void;
  error: string;
  setError: (value: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Enter your email address and password to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user: authUser }, error: signInError } =
        await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInError) throw signInError;
      if (!authUser) throw new Error("Unable to retrieve your account.");

      let role: MemberRole;
      try {
        role = await getMemberRole(authUser.id);
      } catch (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }

      onSignedIn({ id: authUser.id, email: authUser.email ?? normalizedEmail, role });
      setPassword("");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.authContainer}>
          <View style={styles.brandMark}><Text style={styles.brandInitials}>DL</Text></View>
          <Text style={styles.eyebrow}>DLMSF MONITORING</Text>
          <Text style={styles.authTitle}>DLMSF Monitoring</Text>
          <Text style={styles.subtitle}>Sign in to your account.</Text>

          <View style={styles.card}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <FieldLabel text="Email address" />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={email}
            />
            <FieldLabel text="Password" />
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
              placeholder="Enter your password"
              placeholderTextColor="#94A3B8"
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              value={password}
            />
            {error ? <ErrorBox message={error} /> : null}
            <PrimaryButton label="Sign in" loading={submitting} onPress={handleSignIn} />
          </View>
        </View>
        <Text style={styles.footer}>DLMSF · Mobile</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthenticatedApp({ user, onSignOut }: { user: AuthenticatedUser; onSignOut: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("home");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeFiscalYear, setActiveFiscalYear] = useState<FiscalYear | null>(null);
  const [fyLoading, setFyLoading] = useState(true);
  const [fyError, setFyError] = useState("");

  function refreshAll() {
    setRefreshKey((value) => value + 1);
  }

  useEffect(() => {
    let mounted = true;
    async function loadActiveFiscalYear() {
      setFyLoading(true);
      try {
        const fiscalYear = await apiRequest<FiscalYear | null>("/api/fiscal-years/current");
        if (!mounted) return;
        setActiveFiscalYear(fiscalYear);
        setFyError("");
      } catch (error) {
        if (!mounted) return;
        setActiveFiscalYear(null);
        setFyError(getErrorMessage(error));
      } finally {
        if (mounted) setFyLoading(false);
      }
    }
    void loadActiveFiscalYear();
    return () => { mounted = false; };
  }, [refreshKey, user.role]);

  const memberTabs: { key: Tab; label: string }[] = [
    { key: "home", label: "Dashboard" },
    { key: "loans", label: "Loans" },
    { key: "payments", label: "Payments" },
    { key: "account", label: "Account" },
  ];
  const adminTabs: { key: Tab; label: string }[] = [
    { key: "home", label: "Dashboard" },
    { key: "members", label: "Members" },
    { key: "loans", label: "Loans" },
    { key: "payments", label: "Payments" },
    { key: "audit", label: "Audit" },
    { key: "settings", label: "Settings" },
    { key: "account", label: "Account" },
  ];
  const tabs = user.role === "admin" ? adminTabs : memberTabs;

  return (
    <View style={styles.appShell}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topEyebrow}>DLMSF MONITORING</Text>
          <Text style={styles.topTitle}>{user.role === "admin" ? "Administration" : "Member Portal"}</Text>
          {activeFiscalYear ? <Text style={styles.mutedSmall}>Current period · {activeFiscalYear.code}</Text> : null}
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user.role === "admin" ? "ADMIN" : "MEMBER"}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {fyLoading ? <ScreenLoader /> : fyError ? <ErrorState message={fyError} onRetry={refreshAll} /> : (
          <>
            {user.role === "admin" && tab === "settings" && <AdminFiscalSettingsScreen refreshKey={refreshKey} onChanged={refreshAll} />}
            
            {(!activeFiscalYear && tab !== "settings" && tab !== "fiscal" && tab !== "account") ? (
              <FiscalYearRequiredScreen role={user.role} onOpenSettings={() => setTab("settings")} />
            ) : null}
            {activeFiscalYear && tab === "home" && <HomeScreen user={user} refreshKey={refreshKey} onNavigate={setTab} />}
            {activeFiscalYear && tab === "loans" && (user.role === "admin" ? <AdminLoansScreen refreshKey={refreshKey} onChanged={refreshAll} /> : <MemberLoansScreen refreshKey={refreshKey} onChanged={refreshAll} />)}
            {activeFiscalYear && tab === "payments" && (user.role === "admin" ? <AdminPaymentsScreen refreshKey={refreshKey} onChanged={refreshAll} /> : <MemberPaymentsScreen refreshKey={refreshKey} onChanged={refreshAll} />)}
            {activeFiscalYear && user.role === "admin" && tab === "audit" && <AdminAuditScreen refreshKey={refreshKey} onChanged={refreshAll} />}
            {activeFiscalYear && user.role === "admin" && tab === "members" && <AdminMembersScreen refreshKey={refreshKey} onChanged={refreshAll} />}
            {tab === "account" && <AccountScreen user={user} onSignOut={onSignOut} />}
          </>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarScroll}>
        {tabs.map((item) => (
          <TouchableOpacity key={item.key} onPress={() => setTab(item.key)} style={styles.tabButton}>
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function HomeScreen({
  user,
  refreshKey,
  onNavigate,
}: {
  user: AuthenticatedUser;
  refreshKey: number;
  onNavigate: (tab: Tab) => void;
}) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      setDashboard(await apiRequest<Dashboard>("/api/dashboard"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading && !dashboard) return <ScreenLoader />;
  if (error && !dashboard) return <ErrorState message={error} onRetry={() => void load()} />;

  const data = dashboard ?? { payments: [], loans: [], loanPayments: [] };
  if (user.role === "member") return <MemberHome data={data} refreshing={refreshing} onRefresh={() => void load(true)} onNavigate={onNavigate} />;

  const members = data.members ?? [];
  const totalHeads = members.reduce((sum, member) => sum + Number(member.heads || 0), 0);
  const weeklyCollected = data.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const loanPayments = data.loanPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = data.loans
    .filter((loan) => String(loan.status).toLowerCase() !== "paid")
    .reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const availableFunds = Math.max(weeklyCollected - outstanding, 0);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
    >
      <View style={styles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionEyebrow}>OVERVIEW</Text>
          <Text style={styles.pageTitle}>Good day, Admin</Text>
          <Text style={styles.muted}>Here is the current fund and loan picture.</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="Members" value={String(members.length)} />
        <StatCard label="Total Heads" value={String(totalHeads)} />
        <StatCard label="Sinking Fund" value={wholeCurrency(weeklyCollected)} />
        <StatCard label="Available Funds" value={wholeCurrency(availableFunds)} />
        <StatCard label="Loan Payments" value={wholeCurrency(loanPayments)} />
        <StatCard label="Outstanding Principal" value={wholeCurrency(outstanding)} />
      </View>
      <SectionHeader title="Recent activity" />
      {data.loanPayments.slice(0, 4).map((payment, index) => (
        <ActivityRow
          key={String(payment.id ?? index)}
          title={payment.borrower ?? "Member"}
          detail={`Loan payment · ${shortDate(payment.paid_at)}`}
          amount={wholeCurrency(payment.amount)}
        />
      ))}
      {!data.loanPayments.length ? <EmptyState title="No loan payments yet" message="Recent confirmed loan payments will appear here." /> : null}
    </ScrollView>
  );
}

function MemberHome({
  data,
  refreshing,
  onRefresh,
  onNavigate,
}: {
  data: Dashboard;
  refreshing: boolean;
  onRefresh: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const member = data.member;
  const heads = Number(member?.heads || 0);
  const weeklyDue = heads * 50;
  const latestPayment = data.payments[0];
  const activeLoans = data.loans.filter((loan) => String(loan.status).toLowerCase() !== "paid");
  const activeLoan = activeLoans[0];
  const outstanding = activeLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
    >
      <Text style={styles.sectionEyebrow}>MEMBER DASHBOARD</Text>
      <Text style={styles.pageTitle}>Hello, {member?.name ?? "Member"}</Text>
      <Text style={styles.muted}>Your DLMSF contributions and loan status.</Text>
      {member?.tier_code ? <View style={styles.memberTierLine}><TierBadge tier={member.tier_code} /></View> : null}

      <View style={styles.heroCard}>
        <Text style={styles.cardEyebrow}>WEEKLY OBLIGATION</Text>
        <Text style={styles.heroValue}>{wholeCurrency(weeklyDue)}</Text>
        <Text style={styles.heroSub}>{heads} head{heads === 1 ? "" : "s"} × ₱50</Text>
        <View style={styles.heroDivider} />
        <View style={styles.inlineStat}>
          <Text style={styles.heroLabel}>Latest collection</Text>
          <Text style={styles.heroLabelValue}>{latestPayment ? wholeCurrency(latestPayment.amount) : "No payment"}</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="Active Loans" value={String(activeLoans.length)} />
        <StatCard label="Outstanding" value={wholeCurrency(outstanding)} />
      </View>

      <SectionHeader title="Loan status" />
      {activeLoan ? (
        <InfoCard>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Loan #{activeLoan.id}</Text>
              <Text style={styles.mutedSmall}>{String(activeLoan.status || "Active")}</Text>
            </View>
            <StatusPill status={activeLoan.status} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Principal" value={wholeCurrency(activeLoan.amount)} />
            <Detail label="Monthly" value={wholeCurrency(activeLoan.monthly)} />
            <Detail label="Total" value={wholeCurrency(activeLoan.total)} />
            <Detail label="Term" value={`${activeLoan.months} mo.`} />
          </View>
        </InfoCard>
      ) : (
        <EmptyState title="No active loan" message="You currently have no outstanding loan." />
      )}

      <SectionHeader title="Recent payments" />
      {data.loanPayments.slice(0, 3).map((payment, index) => (
        <ActivityRow
          key={String(payment.id ?? index)}
          title={wholeCurrency(payment.amount)}
          detail={`Loan payment · ${shortDate(payment.paid_at)}`}
          amount=""
        />
      ))}
      {!data.loanPayments.length ? <EmptyState title="No loan payments" message="Your loan payment history will appear here." /> : null}

      <View style={styles.actionRow}>
        <ActionButton label="View Loans" onPress={() => onNavigate("loans")} />
        <ActionButton label="Payments" secondary onPress={() => onNavigate("payments")} />
      </View>
    </ScrollView>
  );
}

function MemberLoansScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [loans, setLoans] = useState<any[]>([]);
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("3");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [loanData, requestData] = await Promise.all([
        apiRequest<any[]>("/api/loans"),
        apiRequest<LoanRequest[]>("/api/loans/requests"),
      ]);
      setLoans(loanData);
      setRequests(requestData);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const activeLoan = loans.find((loan) => String(loan.status).toLowerCase() !== "paid");
  const pendingRequest = requests.find((request) => String(request.status).toLowerCase() === "pending");

  async function submitRequest() {
    const value = Number(amount.replace(/,/g, ""));
    const term = Number(months);
    if (!Number.isFinite(value) || value < 500 || value % 500 !== 0) {
      Alert.alert("Invalid amount", "Enter a loan amount of at least ₱500 in ₱500 increments.");
      return;
    }
    if (![1, 2, 3, 4, 5, 6, 9, 12, 18, 24].includes(term)) {
      Alert.alert("Invalid term", "Choose a valid repayment duration.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/api/loans/requests", {
        method: "POST",
        body: JSON.stringify({ amount: value, months: term }),
      });
      setModal(false);
      setAmount("");
      Alert.alert("Request submitted", "Your loan request has been sent for administrator review.");
      onChanged();
    } catch (e) {
      Alert.alert("Unable to submit", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !loans.length && !requests.length) return <ScreenLoader />;
  if (error && !loans.length && !requests.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
    >
      <Text style={styles.sectionEyebrow}>LOANS</Text>
      <Text style={styles.pageTitle}>Your loans</Text>
      <Text style={styles.muted}>Track your current loan and submitted requests.</Text>

      {activeLoan ? (
        <InfoCard>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Loan #{activeLoan.id}</Text>
              <Text style={styles.mutedSmall}>Current loan</Text>
            </View>
            <StatusPill status={activeLoan.status} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Principal" value={wholeCurrency(activeLoan.amount)} />
            <Detail label="Monthly" value={wholeCurrency(activeLoan.monthly)} />
            <Detail label="Total" value={wholeCurrency(activeLoan.total)} />
            <Detail label="Term" value={`${activeLoan.months} mo.`} />
          </View>
        </InfoCard>
      ) : null}

      <PrimaryButton
        label={activeLoan ? "Request Loan" : pendingRequest ? "Request Pending" : "Request Loan"}
        disabled={Boolean(activeLoan || pendingRequest)}
        onPress={() => setModal(true)}
      />
      {activeLoan ? <Text style={styles.helperText}>You already have an active loan. A new loan cannot be requested until it is paid.</Text> : null}

      <SectionHeader title="Request history" />
      {requests.map((request) => (
        <InfoCard key={request.id}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Request #{request.id}</Text>
              <Text style={styles.mutedSmall}>{dateLabel(request.requested_at)}</Text>
            </View>
            <StatusPill status={request.status} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Amount" value={wholeCurrency(request.amount)} />
            <Detail label="Term" value={`${request.months} mo.`} />
          </View>
          {request.admin_remarks ? <Text style={styles.note}>{request.admin_remarks}</Text> : null}
        </InfoCard>
      ))}
      {!requests.length ? <EmptyState title="No requests yet" message="Your loan requests will appear here." /> : null}

      <Modal transparent visible={modal} animationType="none" onRequestClose={() => setModal(false)}>
        <ModalSheet title="Request a loan" onClose={() => setModal(false)}>
          <FieldLabel text="Amount" />
          <TextInput
            keyboardType="numeric"
            onChangeText={setAmount}
            placeholder="e.g. 5000"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={amount}
          />
          <FieldLabel text="Repayment duration" />
          <TextInput
            keyboardType="numeric"
            onChangeText={setMonths}
            placeholder="Months"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={months}
          />
          <Text style={styles.helperText}>Available terms: 1, 2, 3, 4, 5, 6, 9, 12, 18, or 24 months.</Text>
          <PrimaryButton label="Submit request" loading={saving} onPress={() => void submitRequest()} />
        </ModalSheet>
      </Modal>
    </ScrollView>
  );
}

function MemberPaymentsScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [loanId, setLoanId] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [paymentData, submissionData, loanData] = await Promise.all([
        apiRequest<any>("/api/payments"),
        apiRequest<PaymentSubmission[]>("/api/payments/submissions"),
        apiRequest<any[]>("/api/loans"),
      ]);
      setPayments(paymentData.loanPayments ?? []);
      setSubmissions(submissionData);
      setLoans(loanData.filter((loan) => String(loan.status).toLowerCase() !== "paid"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function submitPayment() {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    if (!paidOn.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD for the payment date.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/api/payments/submissions", {
        method: "POST",
        body: JSON.stringify({
          paymentType: "Loan",
          amount: value,
          paidOn,
          loanId: loanId ? Number(loanId) : null,
          reference: reference.trim() || null,
        }),
      });
      setModal(false);
      setAmount("");
      setReference("");
      Alert.alert("Payment submitted", "Your payment is waiting for administrator confirmation.");
      onChanged();
    } catch (e) {
      Alert.alert("Unable to submit", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !payments.length && !submissions.length) return <ScreenLoader />;
  if (error && !payments.length && !submissions.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
    >
      <Text style={styles.sectionEyebrow}>PAYMENTS</Text>
      <Text style={styles.pageTitle}>Loan payments</Text>
      <Text style={styles.muted}>Submit a payment and track confirmation history.</Text>

      <PrimaryButton label="Submit loan payment" onPress={() => setModal(true)} />

      <SectionHeader title="Payment submissions" />
      {submissions.map((submission) => (
        <InfoCard key={submission.id}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>{wholeCurrency(submission.amount)}</Text>
              <Text style={styles.mutedSmall}>Submitted {dateLabel(submission.submitted_at)}</Text>
            </View>
            <StatusPill status={submission.status} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Paid on" value={dateLabel(submission.paid_on)} />
            <Detail label="Loan" value={submission.loan_id ? `#${submission.loan_id}` : "—"} />
          </View>
          {submission.admin_remarks ? <Text style={styles.note}>{submission.admin_remarks}</Text> : null}
        </InfoCard>
      ))}
      {!submissions.length ? <EmptyState title="No submissions yet" message="Your submitted loan payments will appear here." /> : null}

      <SectionHeader title="Confirmed payment history" />
      {payments.slice(0, 12).map((payment, index) => (
        <ActivityRow
          key={String(payment.id ?? index)}
          title={wholeCurrency(payment.amount)}
          detail={`Loan payment · ${shortDate(payment.paid_at)}`}
          amount=""
        />
      ))}
      {!payments.length ? <EmptyState title="No confirmed payments" message="Confirmed loan payments will appear here." /> : null}

      <Modal transparent visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <ModalSheet title="Submit loan payment" onClose={() => setModal(false)}>
          <FieldLabel text="Amount" />
          <TextInput keyboardType="numeric" onChangeText={setAmount} placeholder="e.g. 15000" placeholderTextColor="#94A3B8" style={styles.input} value={amount} />
          <FieldLabel text="Paid on" />
          <TextInput keyboardType="numbers-and-punctuation" onChangeText={setPaidOn} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" style={styles.input} value={paidOn} />
          <FieldLabel text="Loan ID (optional)" />
          <TextInput keyboardType="numeric" onChangeText={setLoanId} placeholder={loans[0] ? String(loans[0].id) : "Loan ID"} placeholderTextColor="#94A3B8" style={styles.input} value={loanId} />
          <FieldLabel text="Reference (optional)" />
          <TextInput onChangeText={setReference} placeholder="Receipt or reference number" placeholderTextColor="#94A3B8" style={styles.input} value={reference} />
          <PrimaryButton label="Submit payment" loading={saving} onPress={() => void submitPayment()} />
        </ModalSheet>
      </Modal>
    </ScrollView>
  );
}


function AdminLoansScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [loans, setLoans] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [borrowerId, setBorrowerId] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("3");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [loanData, memberData, requestData] = await Promise.all([
        apiRequest<any[]>("/api/loans"),
        apiRequest<Member[]>("/api/members"),
        apiRequest<LoanRequest[]>("/api/loans/requests"),
      ]);
      setLoans(loanData);
      setMembers(memberData);
      setRequests(requestData);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function reviewLoanRequest(request: LoanRequest, decision: "Approved" | "Rejected") {
    try {
      await apiRequest(`/api/loans/requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      Alert.alert("Updated", decision === "Approved" ? "Loan request approved." : "Loan request rejected.");
      onChanged();
    } catch (e) {
      Alert.alert("Unable to update", getErrorMessage(e));
    }
  }

  async function createLoan() {
    const value = Number(amount.replace(/,/g, ""));
    const term = Number(months);
    const borrower = Number(borrowerId);
    if (!Number.isInteger(borrower) || borrower < 1) {
      Alert.alert("Borrower required", "Select a valid member.");
      return;
    }
    if (!Number.isFinite(value) || value < 500 || value % 500 !== 0) {
      Alert.alert("Invalid amount", "Enter a loan amount of at least ₱500 in ₱500 increments.");
      return;
    }
    if (![1, 2, 3, 4, 5, 6, 9, 12, 18, 24].includes(term)) {
      Alert.alert("Invalid term", "Choose a valid repayment duration.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/api/loans", {
        method: "POST",
        body: JSON.stringify({ borrowerId: borrower, amount: value, months: term }),
      });
      setModal(false);
      setAmount("");
      setBorrowerId("");
      Alert.alert("Loan created", "The loan has been added to the loan records.");
      onChanged();
    } catch (e) {
      Alert.alert("Unable to create loan", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(loan: any) {
    Alert.alert("Mark loan as paid?", `Loan #${loan.id} will be marked as Paid.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark paid",
        onPress: async () => {
          try {
            await apiRequest(`/api/loans/${loan.id}`, { method: "PATCH", body: JSON.stringify({ status: "Paid" }) });
            Alert.alert("Updated", "The loan has been marked as paid.");
            onChanged();
          } catch (e) {
            Alert.alert("Unable to update", getErrorMessage(e));
          }
        },
      },
    ]);
  }

  async function deleteLoan(loan: any) {
    Alert.alert("Delete loan?", `Delete loan #${loan.id}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/loans/${loan.id}`, { method: "DELETE" });
            Alert.alert("Deleted", "The loan was deleted and its audit record was created.");
            onChanged();
          } catch (e) {
            Alert.alert("Unable to delete", getErrorMessage(e));
          }
        },
      },
    ]);
  }

  const active = loans.filter((loan) => String(loan.status).toLowerCase() !== "paid");
  const paid = loans.filter((loan) => String(loan.status).toLowerCase() === "paid");
  const principal = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const interest = loans.reduce((sum, loan) => sum + Number(loan.interest || 0), 0);
  const total = loans.reduce((sum, loan) => sum + Number(loan.total || 0), 0);

  if (loading && !loans.length) return <ScreenLoader />;
  if (error && !loans.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.flex}>
      <FlatList
      data={loans}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionEyebrow}>LOAN MANAGEMENT</Text>
          <Text style={styles.pageTitle}>Loan dashboard</Text>
          <Text style={styles.muted}>Manage issued loans, balances, and repayment status.</Text>

          <View style={styles.statGrid}>
            <StatCard label="Total Loans" value={String(loans.length)} />
            <StatCard label="Active Loans" value={String(active.length)} />
            <StatCard label="Principal" value={wholeCurrency(principal)} />
            <StatCard label="Interest" value={wholeCurrency(interest)} />
            <StatCard label="Loan Total" value={wholeCurrency(total)} />
            <StatCard label="Paid Loans" value={String(paid.length)} />
          </View>

          <PrimaryButton label="Create loan" onPress={() => setModal(true)} />
          <SectionHeader title="Loan requests" />
          {requests.map((request) => (
            <InfoCard key={`request-${request.id}`}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{request.member?.name ?? "Member"} · {wholeCurrency(request.amount)}</Text>
                  <Text style={styles.mutedSmall}>Request #{request.id} · {request.months} months · {dateLabel(request.requested_at)}</Text>
                </View>
                <StatusPill status={request.status} />
              </View>
              {String(request.status).toLowerCase() === "pending" ? (
                <View style={styles.actionRow}>
                  <ActionButton label="Approve" onPress={() => void reviewLoanRequest(request, "Approved")} />
                  <ActionButton label="Reject" secondary onPress={() => void reviewLoanRequest(request, "Rejected")} />
                </View>
              ) : null}
              {request.admin_remarks ? <Text style={styles.note}>{request.admin_remarks}</Text> : null}
            </InfoCard>
          ))}
          {!requests.length ? <EmptyState title="No loan requests" message="Member loan requests will appear here." /> : null}
          <SectionHeader title="Loan records" />
        </View>
      }
      renderItem={({ item }) => (
        <InfoCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Loan #{item.id}</Text>
              <Text style={styles.mutedSmall}>{item.borrower?.name ?? "Member"}</Text>
            </View>
            <StatusPill status={item.status} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Principal" value={wholeCurrency(item.amount)} />
            <Detail label="Interest" value={wholeCurrency(item.interest)} />
            <Detail label="Total" value={wholeCurrency(item.total)} />
            <Detail label="Monthly" value={wholeCurrency(item.monthly)} />
            <Detail label="Term" value={`${item.months} mo.`} />
            <Detail label="Loan ID" value={String(item.id)} />
          </View>
          <View style={styles.actionRow}>
            {String(item.status).toLowerCase() !== "paid" ? <ActionButton label="Mark paid" onPress={() => void markPaid(item)} /> : null}
            <ActionButton label="Delete" secondary onPress={() => void deleteLoan(item)} />
          </View>
        </InfoCard>
      )}
      ListEmptyComponent={<EmptyState title="No loans" message="Issued loans will appear here." />}
      />


      <Modal transparent visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <ModalSheet title="Create loan" onClose={() => setModal(false)}>
          <FieldLabel text="Member ID" />
          <TextInput keyboardType="numeric" onChangeText={setBorrowerId} placeholder={members[0] ? String(members[0].id) : "Member ID"} placeholderTextColor="#94A3B8" style={styles.input} value={borrowerId} />
          <Text style={styles.helperText}>{members.length ? `Members available: ${members.map((m) => `#${m.id} ${m.name}`).join(", ")}` : "No members available."}</Text>
          <FieldLabel text="Amount" />
          <TextInput keyboardType="numeric" onChangeText={setAmount} placeholder="e.g. 5000" placeholderTextColor="#94A3B8" style={styles.input} value={amount} />
          <FieldLabel text="Repayment duration" />
          <TextInput keyboardType="numeric" onChangeText={setMonths} placeholder="Months" placeholderTextColor="#94A3B8" style={styles.input} value={months} />
          <PrimaryButton label="Create loan" loading={saving} onPress={() => void createLoan()} />
        </ModalSheet>
      </Modal>
    </View>  );
}

function AdminPaymentsScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay());
    return date.toISOString().slice(0, 10);
  });
  const [weekly, setWeekly] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, [refreshKey, weekStart]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [weeklyData, submissionData] = await Promise.all([
        apiRequest<any>(`/api/payments/weekly?weekStart=${weekStart}`),
        apiRequest<PaymentSubmission[]>("/api/payments/submissions"),
      ]);
      setWeekly(weeklyData.members ?? []);
      setSubmissions(submissionData.filter((item) => item.payment_type === "Loan"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function generateAll() {
    Alert.alert("Generate weekly payments?", `Generate the remaining weekly dues for all members for week starting ${weekStart}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Generate",
        onPress: async () => {
          setGenerating(true);
          try {
            await apiRequest("/api/payments/weekly/generate-all", {
              method: "POST",
              body: JSON.stringify({ weekStart, paidOn: new Date().toISOString().slice(0, 10) }),
            });
            Alert.alert("Generated", "Weekly payment records were generated for the selected week.");
            onChanged();
          } catch (e) {
            Alert.alert("Unable to generate", getErrorMessage(e));
          } finally {
            setGenerating(false);
          }
        },
      },
    ]);
  }

  async function reviewPayment(item: PaymentSubmission, decision: "Confirmed" | "Rejected") {
    try {
      await apiRequest(`/api/payments/submissions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      Alert.alert("Updated", decision === "Confirmed" ? "Payment confirmed." : "Payment rejected.");
      onChanged();
    } catch (e) {
      Alert.alert("Unable to update", getErrorMessage(e));
    }
  }

  const expected = weekly.reduce((sum, item) => sum + Number(item.due || 0), 0);
  const recorded = weekly.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const pending = submissions.filter((item) => String(item.status).toLowerCase() === "pending");

  if (loading && !weekly.length && !submissions.length) return <ScreenLoader />;
  if (error && !weekly.length && !submissions.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
    >
      <Text style={styles.sectionEyebrow}>PAYMENTS</Text>
      <Text style={styles.pageTitle}>Payments</Text>
      <Text style={styles.muted}>Manage weekly contributions and loan repayment submissions.</Text>

      <InfoCard>
        <Text style={styles.cardTitle}>Collection week</Text>
        <Text style={styles.mutedSmall}>Select the Sunday used for weekly contribution records.</Text>
        <TextInput
          keyboardType="numbers-and-punctuation"
          value={weekStart}
          onChangeText={setWeekStart}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />
        <PrimaryButton label="Generate weekly payment for all members" loading={generating} onPress={() => void generateAll()} />
      </InfoCard>

      <View style={styles.statGrid}>
        <StatCard label="Expected" value={wholeCurrency(expected)} />
        <StatCard label="Recorded" value={wholeCurrency(recorded)} />
        <StatCard label="Members" value={String(weekly.length)} />
        <StatCard label="Pending loan payments" value={String(pending.length)} />
      </View>

      <SectionHeader title="Loan repayment submissions" />
      {submissions.map((item) => (
        <InfoCard key={item.id}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{wholeCurrency(item.amount)}</Text>
              <Text style={styles.mutedSmall}>{item.member?.name ?? "Member"} · {dateLabel(item.submitted_at)}</Text>
            </View>
            <StatusPill status={item.status} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Paid on" value={dateLabel(item.paid_on)} />
            <Detail label="Loan" value={item.loan_id ? `#${item.loan_id}` : "—"} />
          </View>
          {String(item.status).toLowerCase() === "pending" ? (
            <View style={styles.actionRow}>
              <ActionButton label="Confirm" onPress={() => void reviewPayment(item, "Confirmed")} />
              <ActionButton label="Reject" secondary onPress={() => void reviewPayment(item, "Rejected")} />
            </View>
          ) : null}
        </InfoCard>
      ))}
      {!submissions.length ? <EmptyState title="No loan repayment submissions" message="Member loan payment submissions will appear here." /> : null}

      <SectionHeader title="Weekly member status" />
      {weekly.slice(0, 50).map((item) => (
        <InfoCard key={String(item.id)}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.mutedSmall}>{item.heads} head{Number(item.heads) === 1 ? "" : "s"}</Text>
            </View>
            <StatusPill status={Number(item.remaining || 0) <= 0 ? "Paid" : Number(item.paid || 0) > 0 ? "Partial" : "Unpaid"} />
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Due" value={wholeCurrency(item.due)} />
            <Detail label="Recorded" value={wholeCurrency(item.paid)} />
            <Detail label="Balance" value={wholeCurrency(item.remaining)} />
          </View>
        </InfoCard>
      ))}
      {!weekly.length ? <EmptyState title="No weekly records" message="Weekly contribution records will appear here." /> : null}
    </ScrollView>
  );
}

function AdminAuditScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [audit, setAudit] = useState<{ loans: AuditRecord[]; payments: AuditRecord[] }>({ loans: [], payments: [] });
  const [tab, setTab] = useState<"loans" | "payments">("loans");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      setAudit(await apiRequest<{ loans: AuditRecord[]; payments: AuditRecord[] }>("/api/audit"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function removeRecord(type: "loan" | "payment", record: AuditRecord) {
    if (record.synthetic) {
      Alert.alert("Audit record", "This workflow event is part of the submission history and cannot be deleted here.");
      return;
    }
    Alert.alert("Delete audit record?", "This removes the audit entry from the audit log.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/audit/${type === "loan" ? "loans" : "payments"}/${record.id}`, { method: "DELETE" });
            Alert.alert("Deleted", "The audit record was deleted.");
            onChanged();
          } catch (e) {
            Alert.alert("Unable to delete", getErrorMessage(e));
          }
        },
      },
    ]);
  }

  const records = tab === "loans" ? audit.loans : audit.payments;

  if (loading && !audit.loans.length && !audit.payments.length) return <ScreenLoader />;
  if (error && !audit.loans.length && !audit.payments.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => `${tab}-${item.id}`}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionEyebrow}>AUDIT</Text>
          <Text style={styles.pageTitle}>Audit dashboard</Text>
          <Text style={styles.muted}>Review financial and workflow activity recorded by DLMSF.</Text>
          <View style={styles.segment}>
            <TouchableOpacity onPress={() => setTab("loans")} style={[styles.segmentButton, tab === "loans" && styles.segmentActive]}>
              <Text style={[styles.segmentText, tab === "loans" && styles.segmentTextActive]}>Loan audit ({audit.loans.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab("payments")} style={[styles.segmentButton, tab === "payments" && styles.segmentActive]}>
              <Text style={[styles.segmentText, tab === "payments" && styles.segmentTextActive]}>Payment audit ({audit.payments.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <InfoCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.action || "Audit activity"}</Text>
              <Text style={styles.mutedSmall}>{item.borrower_name || (item.member_id ? `Member #${item.member_id}` : "DLMSF")}</Text>
            </View>
            <Text style={styles.activityAmount}>{item.amount != null ? wholeCurrency(item.amount) : ""}</Text>
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Date" value={dateLabel(item.created_date)} />
            <Detail label="Actor" value={item.actor_role || "System"} />
            {item.week_start ? <Detail label="Week" value={dateLabel(item.week_start)} /> : null}
            {item.loan_request_id ? <Detail label="Request" value={`#${item.loan_request_id}`} /> : null}
          </View>
          {item.remarks ? <Text style={styles.note}>{item.remarks}</Text> : null}
          {!item.synthetic ? <TouchableOpacity style={styles.smallDelete} onPress={() => void removeRecord(tab === "loans" ? "loan" : "payment", item)}><Text style={styles.smallDeleteText}>Delete audit entry</Text></TouchableOpacity> : null}
        </InfoCard>
      )}
      ListEmptyComponent={<EmptyState title="No audit records" message="Recorded activity will appear here." />}
    />
  );
}

function AdminRequestsScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [tab, setTab] = useState<"loans" | "payments">("loans");
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<{ type: "loan" | "payment"; item: LoanRequest | PaymentSubmission } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [loanData, paymentData] = await Promise.all([
        apiRequest<LoanRequest[]>("/api/loans/requests"),
        apiRequest<PaymentSubmission[]>("/api/payments/submissions"),
      ]);
      setLoans(loanData);
      setPayments(paymentData);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function review(decision: string) {
    if (!reviewing) return;
    setSaving(true);
    try {
      if (reviewing.type === "loan") {
        await apiRequest(`/api/loans/requests/${reviewing.item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        });
      } else {
        await apiRequest(`/api/payments/submissions/${reviewing.item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        });
      }
      setReviewing(null);
      Alert.alert("Updated", decision === "Approved" || decision === "Confirmed" ? "The request was approved." : "The request was rejected.");
      onChanged();
    } catch (e) {
      Alert.alert("Unable to update", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const pendingLoans = loans.filter((item) => String(item.status).toLowerCase() === "pending");
  const pendingPayments = payments.filter((item) => String(item.status).toLowerCase() === "pending");
  const items = tab === "loans" ? loans : payments;

  if (loading && !loans.length && !payments.length) return <ScreenLoader />;
  if (error && !loans.length && !payments.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
    >
      <Text style={styles.sectionEyebrow}>WORKFLOW</Text>
      <Text style={styles.pageTitle}>Requests</Text>
      <Text style={styles.muted}>Review member loan and payment submissions.</Text>

      <View style={styles.segment}>
        <TouchableOpacity onPress={() => setTab("loans")} style={[styles.segmentButton, tab === "loans" && styles.segmentActive]}>
          <Text style={[styles.segmentText, tab === "loans" && styles.segmentTextActive]}>Loans ({pendingLoans.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("payments")} style={[styles.segmentButton, tab === "payments" && styles.segmentActive]}>
          <Text style={[styles.segmentText, tab === "payments" && styles.segmentTextActive]}>Payments ({pendingPayments.length})</Text>
        </TouchableOpacity>
      </View>

      {items.map((item) => (
        <InfoCard key={item.id}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {tab === "loans"
                  ? `Loan request · ${wholeCurrency((item as LoanRequest).amount)}`
                  : `Payment · ${wholeCurrency((item as PaymentSubmission).amount)}`}
              </Text>
              <Text style={styles.mutedSmall}>
                {tab === "loans"
                  ? (item as LoanRequest).member?.name ?? "Member"
                  : (item as PaymentSubmission).member?.name ?? "Member"}
              </Text>
            </View>
            <StatusPill status={item.status} />
          </View>

          <View style={styles.detailGrid}>
            {tab === "loans" ? (
              <>
                <Detail label="Term" value={`${(item as LoanRequest).months} mo.`} />
                <Detail label="Requested" value={dateLabel((item as LoanRequest).requested_at)} />
              </>
            ) : (
              <>
                <Detail label="Paid on" value={dateLabel((item as PaymentSubmission).paid_on)} />
                <Detail label="Loan" value={(item as PaymentSubmission).loan_id ? `#${(item as PaymentSubmission).loan_id}` : "—"} />
              </>
            )}
          </View>

          {String(item.status).toLowerCase() === "pending" ? (
            <View style={styles.reviewActions}>
              <TouchableOpacity style={styles.rejectButton} onPress={() => setReviewing({ type: tab === "loans" ? "loan" : "payment", item })}>
                <Text style={styles.rejectText}>Review</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {item.admin_remarks ? <Text style={styles.note}>{item.admin_remarks}</Text> : null}
        </InfoCard>
      ))}
      {!items.length ? <EmptyState title={`No ${tab} requests`} message="There are no submissions to display." /> : null}

      <Modal transparent visible={Boolean(reviewing)} animationType="slide" onRequestClose={() => setReviewing(null)}>
        <ModalSheet title={reviewing?.type === "loan" ? "Review loan request" : "Review payment"} onClose={() => setReviewing(null)}>
          {reviewing ? (
            <>
              <Text style={styles.modalLead}>
                {reviewing.type === "loan"
                  ? `${reviewing.item.member?.name ?? "Member"} requested ${wholeCurrency((reviewing.item as LoanRequest).amount)} for ${(reviewing.item as LoanRequest).months} months.`
                  : `${reviewing.item.member?.name ?? "Member"} submitted ${wholeCurrency((reviewing.item as PaymentSubmission).amount)}.`}
              </Text>
              <View style={styles.actionRow}>
                <ActionButton label={reviewing.type === "loan" ? "Approve" : "Confirm"} onPress={() => void review(reviewing.type === "loan" ? "Approved" : "Confirmed")} />
                <ActionButton label="Reject" secondary onPress={() => void review("Rejected")} disabled={saving} />
              </View>
              {saving ? <ActivityIndicator color={BLUE} style={{ marginTop: 14 }} /> : null}
            </>
          ) : null}
        </ModalSheet>
      </Modal>
    </ScrollView>
  );
}

function AdminSettingsHome({ activeFiscalYear, onNavigate }: { activeFiscalYear: FiscalYear | null; onNavigate: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionEyebrow}>APP PREFERENCES</Text>
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.muted}>Manage DLMSF-wide configuration and fiscal-year rules.</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onNavigate} style={styles.settingsCard}>
        <View style={styles.settingsIcon}><Text style={styles.settingsIconText}>FY</Text></View>
        <View style={styles.settingsCardBody}>
          <Text style={styles.cardTitle}>Fiscal Year Management</Text>
          <Text style={styles.mutedSmall}>Create fiscal years, configure membership tiers, head limits, retention, and exports.</Text>
          {activeFiscalYear ? (
            <View style={styles.settingsMetaRow}><View style={styles.activeDot} /><Text style={styles.settingsMetaText}>{activeFiscalYear.code} · {activeFiscalYear.start_date} to {activeFiscalYear.end_date}</Text></View>
          ) : <Text style={styles.settingsRequiredText}>Required before members and financial activity can be managed.</Text>}
        </View>
        <Text style={styles.settingsChevron}>›</Text>
      </TouchableOpacity>
      <InfoCard>
        <Text style={styles.cardTitle}>More app settings</Text>
        <Text style={styles.mutedSmall}>Additional application preferences can be added here as DLMSF grows.</Text>
        <Text style={styles.helperText}>Coming later · notifications, security, and data preferences.</Text>
      </InfoCard>
    </ScrollView>
  );
}

function FiscalYearRequiredScreen({ role, onOpenSettings }: { role: MemberRole; onOpenSettings: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.fyRequiredIcon}><Text style={styles.fyRequiredIconText}>FY</Text></View>
      <Text style={styles.sectionEyebrow}>FISCAL YEAR REQUIRED</Text>
      <Text style={styles.pageTitle}>Set up the fiscal year first</Text>
      <Text style={styles.muted}>DLMSF needs an active fiscal year before member assignments, contributions, loan requests, or other financial activity can be created.</Text>
      <InfoCard>
        <Text style={styles.cardTitle}>What needs to happen?</Text>
        <Text style={styles.mutedSmall}>1. Create a fiscal year and choose its date range.</Text>
        <Text style={styles.mutedSmall}>2. Configure Bronze, Silver, and Gold tier rules.</Text>
        <Text style={styles.mutedSmall}>3. Activate the fiscal year.</Text>
      </InfoCard>
      {role === "admin" ? <PrimaryButton label="Set up fiscal year" onPress={onOpenSettings} /> : (
        <Text style={styles.helperText}>Please contact your DLMSF administrator. Member features will become available once the fiscal year is activated and your membership is assigned.</Text>
      )}
    </ScrollView>
  );
}

function TierBadge({ tier, detail }: { tier: string; detail?: string }) {
  const code = tier.toLowerCase();
  const palette = code === "gold"
    ? { backgroundColor: "#FFF7DB", borderColor: "#E8C45B", color: "#8A5A00", mark: "★" }
    : code === "silver"
      ? { backgroundColor: "#F1F5F9", borderColor: "#B8C3D1", color: "#475569", mark: "✦" }
      : { backgroundColor: "#F8E9DF", borderColor: "#C58B65", color: "#8A4B2D", mark: "◆" };
  return (
    <View style={[styles.tierBadge, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <Text style={[styles.tierBadgeMark, { color: palette.color }]}>{palette.mark}</Text>
      <Text style={[styles.tierBadgeText, { color: palette.color }]}>{code.toUpperCase()}</Text>
      {detail ? <Text style={[styles.tierBadgeDetail, { color: palette.color }]}> · {detail}</Text> : null}
    </View>
  );
}

function tierCardStyle(tier?: string | null) {
  const code = String(tier ?? "").toLowerCase();
  if (code === "gold") return { backgroundColor: "#FFFDF5", borderColor: "#E8C45B" };
  if (code === "silver") return { backgroundColor: "#FAFBFC", borderColor: "#CBD5E1" };
  if (code === "bronze") return { backgroundColor: "#FDF8F4", borderColor: "#D7A17D" };
  return {};
}

function AdminMembersScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const showToast = useToast();
  const [members, setMembers = useState<Member[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [activeFiscalYear, setActiveFiscalYear] = useState<FiscalYear | null>(null);
  const [assignments, setAssignments] = useState<Record<number, { tier_code: string; assigned_heads: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [tier, setTier] = useState("bronze");
  const [tierHeads, setTierHeads] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [memberData, fyData] = await Promise.all([
        apiRequest<Member[]>("/api/members"),
        apiRequest<FiscalYear[]>("/api/fiscal-years"),
      ]);
      setMembers(memberData);
      setFiscalYears(fyData);
      const current = fyData.find((fy) => fy.status === "active") ?? fyData[0] ?? null;
      setActiveFiscalYear(current);
      if (current) {
        const settings = await apiRequest<FiscalYearSettings>(`/api/fiscal-years/${current.id}/settings`);
        const map: Record<number, { tier_code: string; assigned_heads: number }> = {};
        for (const assignment of settings.assignments) map[assignment.member_id] = { tier_code: assignment.tier_code, assigned_heads: Number(assignment.assigned_heads) };
        setAssignments(map);
      } else {
        setAssignments({});
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreate() {
    if (!activeFiscalYear) { Alert.alert("Fiscal year required", "Create and activate a fiscal year before adding members."); return; }
    setSelected(null); setName(""); setTier("bronze"); setTierHeads("1"); setModal("create");
  }
  function openEdit(member: Member) {
    setSelected(member); setName(member.name); setModal("edit");
    const assignment = assignments[member.id];
    setTier(assignment?.tier_code ?? "bronze"); setTierHeads(String(assignment?.assigned_heads ?? member.heads ?? 1));
  }
  async function saveMember() {
    if (!activeFiscalYear) { Alert.alert("Fiscal year required", "Create and activate a fiscal year before managing members."); return; }
    const trimmed = name.trim();
    const headCount = Number(tierHeads);
    if (!trimmed || !Number.isInteger(headCount) || headCount < 1) {
      Alert.alert("Invalid member", "Enter a name and a whole number of heads.");
      return;
    }
    setSaving(true);
    try {
      let memberId = selected?.id;
      if (modal === "create") {
        const result = await apiRequest<{ member: Member; loginEmail: string; temporaryPassword: string }>("/api/members", {
          method: "POST", body: JSON.stringify({ name: trimmed, heads: headCount }),
        });
        memberId = result.member.id;
        Alert.alert("Member created", `Login: ${result.loginEmail}\nTemporary password: ${result.temporaryPassword}\n\nShare these credentials securely with the member.`);
      } else if (selected) {
        await apiRequest(`/api/members/${selected.id}`, { method: "PATCH", body: JSON.stringify({ name: trimmed, heads: headCount }) });
        showToast("Member updated");
      }
      if (activeFiscalYear && memberId) {
        await apiRequest(`/api/fiscal-years/${activeFiscalYear.id}/members/${memberId}`, {
          method: "PUT", body: JSON.stringify({ tierCode: tier, assignedHeads: Number(tierHeads) }),
        });
      }
      setModal(null); onChanged();
    } catch (e) {
      Alert.alert("Unable to save", getErrorMessage(e));
    } finally { setSaving(false); }
  }

  function confirmDelete(member: Member) {
    Alert.alert("Delete member?", `This will delete ${member.name} and the linked login. This action cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiRequest(`/api/members/${member.id}`, { method: "DELETE" });
          Alert.alert("Deleted", "The member and linked login were deleted.");
          onChanged();
        } catch (e) { Alert.alert("Unable to delete", getErrorMessage(e)); }
      }},
    ]);
  }

  if (loading && !members.length) return <ScreenLoader />;
  if (error && !members.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.flex}>
      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.memberListContent}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionEyebrow}>MEMBERS</Text>
            <Text style={styles.pageTitle}>Member accounts</Text>
            <Text style={styles.muted}>Manage members, FY assignments, and linked logins.</Text>
            <View style={styles.memberAddAction}>
              <ActionButton label="Add member" onPress={openCreate} />
            </View>
            {activeFiscalYear ? <InfoCard><Text style={styles.cardEyebrow}>ACTIVE FISCAL YEAR</Text><Text style={styles.cardTitle}>{activeFiscalYear.code}</Text><Text style={styles.mutedSmall}>{activeFiscalYear.start_date} → {activeFiscalYear.end_date}</Text></InfoCard> : <EmptyState title="No fiscal year configured" message="Create and configure the next fiscal year before assigning tiers." />}
          </View>
        }
        renderItem={({ item }) => {
          const assignment = assignments[item.id];
          const weeklyContribution = assignment ? Number(assignment.assigned_heads) * 50 : 0;
          return (
            <InfoCard style={tierCardStyle(assignment?.tier_code)}>
              <View style={styles.memberCardBody}>
                <View style={styles.memberTopRow}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {activeFiscalYear && assignment ? <TierBadge tier={assignment.tier_code} /> : null}
                </View>

                {activeFiscalYear && assignment ? (
                  <View style={styles.memberContributionRow}>
                    <Text style={styles.tierMeta}>{assignment.assigned_heads} {assignment.assigned_heads === 1 ? "head" : "heads"}</Text>
                    <View style={styles.weeklyContribution}>
                      <Text style={styles.weeklyContributionLabel}>Expected weekly</Text>
                      <Text style={styles.weeklyContributionValue}>{wholeCurrency(weeklyContribution)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.tierMeta}>Not assigned to the active FY</Text>
                )}

                <View style={styles.memberActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.memberActionButton}><Text style={styles.smallActionText}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.memberActionButtonDelete}><Text style={styles.smallDeleteText}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            </InfoCard>
          );
        }}
        ListEmptyComponent={<EmptyState title="No members" message="Member accounts will appear here." />}
      />

      <Modal transparent visible={Boolean(modal)} animationType="none" onRequestClose={() => setModal(null)}>
        <ModalSheet title={modal === "create" ? "Add member" : "Edit member"} onClose={() => setModal(null)}>
          {modal ? (
            <>
              <FieldLabel text="Name" />
              <TextInput onChangeText={setName} placeholder="Member name" placeholderTextColor="#94A3B8" style={styles.input} value={name} />
              {activeFiscalYear ? (
                <>
                  <FieldLabel text={`Membership tier · ${activeFiscalYear.code}`} />
                  <TierPicker value={tier} onChange={setTier} />
                  <FieldLabel text={`Assigned heads · ${activeFiscalYear.code}`} />
                  <TextInput keyboardType="numeric" onChangeText={setTierHeads} placeholder="1" placeholderTextColor="#94A3B8" style={styles.input} value={tierHeads} />
                </>
              ) : null}
              {modal === "create" ? <Text style={styles.helperText}>A linked Supabase login is created by the existing backend account workflow.</Text> : null}
              <PrimaryButton label={modal === "create" ? "Create member" : "Save changes"} loading={saving} onPress={() => void saveMember()} />
            </>
          ) : null}
        </ModalSheet>
      </Modal>

    </View>
  );
}

function TierPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.tierPicker}>
      {["bronze", "silver", "gold"].map((item) => (
        <TouchableOpacity key={item} onPress={() => onChange(item)} style={[styles.tierOption, value === item && styles.tierOptionActive]}>
          <View style={styles.tierOptionContent}>
            <TierBadge tier={item} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AdminFiscalSettingsScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const showToast = useToast();
  const [fiscalYears, setFiscalYears = useState<FiscalYear[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [settings, setSettings] = useState<FiscalYearSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxTotalHeads, setMaxTotalHeads] = useState("");
  const [retentionMonths, setRetentionMonths] = useState("3");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [draftTiers, setDraftTiers] = useState<DraftTier[]>(createDefaultDraftTiers());

  useEffect(() => { void loadYears(); }, [refreshKey]);

  async function loadYears() {
    setLoading(true);
    try {
      const years = await apiRequest<FiscalYear[]>("/api/fiscal-years");
      setFiscalYears(years);
      const id = selectedId && years.some((fy) => fy.id === selectedId) ? selectedId : (years.find((fy) => fy.status === "active")?.id ?? years[0]?.id ?? null);
      setSelectedId(id);
      if (id) await loadSettings(id);
      else setSettings(null);
    } catch (e) { Alert.alert("Unable to load settings", getErrorMessage(e)); }
    finally { setLoading(false); }
  }

  async function loadSettings(id: number) {
    const data = await apiRequest<FiscalYearSettings>(`/api/fiscal-years/${id}/settings`);
    const orderedTiers = [...data.tiers].sort((left, right) => {
      const order: Record<string, number> = { bronze: 0, silver: 1, gold: 2 };
      return (order[left.tier_code.toLowerCase()] ?? 99) - (order[right.tier_code.toLowerCase()] ?? 99);
    });
    setSettings({ ...data, tiers: orderedTiers });
    setCode(data.fiscalYear.code);
    setStartDate(data.fiscalYear.start_date);
    setEndDate(data.fiscalYear.end_date);
    setMaxTotalHeads(data.fiscalYear.max_total_heads == null ? "" : String(data.fiscalYear.max_total_heads));
    setRetentionMonths(String(data.fiscalYear.retention_months ?? 3));
  }

  function openEditSettings() {
    if (!settings) return;
    setCode(settings.fiscalYear.code);
    setStartDate(settings.fiscalYear.start_date);
    setEndDate(settings.fiscalYear.end_date);
    setMaxTotalHeads(settings.fiscalYear.max_total_heads == null ? "" : String(settings.fiscalYear.max_total_heads));
    setRetentionMonths(String(settings.fiscalYear.retention_months ?? 3));
    setDraftTiers(settings.tiers.map((tier) => ({
      tierCode: tier.tier_code as DraftTier["tierCode"], displayName: tier.display_name, enabled: true,
      maxHeadsPerMember: tier.max_heads_per_member == null ? "" : String(tier.max_heads_per_member),
      loanEligible: tier.loan_eligible, loanLimitMode: tier.loan_limit_mode,
    })));
    setShowEditSettings(true);
  }

  async function saveAllSettings() {
    if (!selectedId) return;
    if (!code.trim() || !startDate || !endDate) {
      Alert.alert("Missing information", "Enter the fiscal year code, start date, and end date.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/api/fiscal-years/${selectedId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          code: code.trim(), startDate, endDate,
          maxTotalHeads: maxTotalHeads === "" ? null : Number(maxTotalHeads),
          retentionMonths: Number(retentionMonths),
          tiers: draftTiers.map((tier) => ({
            tierCode: tier.tierCode, displayName: tier.displayName, enabled: true,
            maxHeadsPerMember: tier.maxHeadsPerMember === "" ? null : Number(tier.maxHeadsPerMember),
            loanEligible: tier.loanEligible, loanLimitMode: tier.loanLimitMode,
          })),
        }),
      });
      setShowEditSettings(false);
      await loadYears();
      onChanged();
      showToast("Fiscal year settings updated");
    } catch (e) { Alert.alert("Unable to save settings", getErrorMessage(e)); }
    finally { setSaving(false); }
  }

  async function createYear() {
    if (!code.trim() || !startDate || !endDate) {
      Alert.alert("Missing information", "Enter a fiscal year code, start date, and end date.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{ fiscalYear: FiscalYear }>("/api/fiscal-years", {
        method: "POST", body: JSON.stringify({
          code: code.trim(), startDate, endDate,
          maxTotalHeads: maxTotalHeads === "" ? null : Number(maxTotalHeads),
          retentionMonths: Number(retentionMonths),
          tiers: draftTiers.map((tier) => ({
            tierCode: tier.tierCode, displayName: tier.displayName, enabled: true,
            maxHeadsPerMember: tier.maxHeadsPerMember === "" ? null : Number(tier.maxHeadsPerMember),
            loanEligible: tier.loanEligible, loanLimitMode: tier.loanLimitMode,
            
          })),
        })
      });
      setShowCreate(false);
      await loadYears();
      setSelectedId(result.fiscalYear.id);
      await loadSettings(result.fiscalYear.id);
      onChanged();
      showToast(`Fiscal Year ${result.fiscalYear.code} has been created`);
    } catch (e) { Alert.alert("Unable to create", getErrorMessage(e)); }
    finally { setSaving(false); }
  }

  async function changeStatus(action: "activate" | "close") {
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiRequest(`/api/fiscal-years/${selectedId}/${action}`, { method: "POST" });
      await loadYears(); await loadSettings(selectedId); onChanged();
      Alert.alert("Updated", action === "activate" ? "Fiscal year activated." : "Fiscal year closed.");
    } catch (e) { Alert.alert("Unable to update", getErrorMessage(e)); }
    finally { setSaving(false); }
  }

  async function exportYear() {
    if (!selectedId || !settings) return;
    setExporting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Your session has expired. Please sign in again.");
      const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/fiscal-years/${selectedId}/export`, { headers: { Authorization: `Bearer ${session.access_token}` }});
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to export fiscal year activities.");
      }
      const workbook = new Uint8Array(await response.arrayBuffer());
      const file = new File(Paths.cache, `DLMSF-${settings.fiscalYear.code}-Activities.xlsx`);
      if (file.exists) file.delete();
      await file.write(workbook);
      if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is not available on this device.");
      await Sharing.shareAsync(file.uri, { dialogTitle: "Export DLMSF fiscal year", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      if (selectedId) await loadSettings(selectedId);
    } catch (e) { Alert.alert("Unable to export", getErrorMessage(e)); }
    finally { setExporting(false); }
  }

  async function deleteYear() {
    if (!selectedId || !settings) return;
    setSaving(true);
    try {
      await apiRequest(`/api/fiscal-years/${selectedId}`, { method: "DELETE", body: JSON.stringify({ confirmation: deleteConfirmation.trim() }) });
      setShowDelete(false); setDeleteConfirmation(""); setSelectedId(null);
      await loadYears(); onChanged();
      Alert.alert("Fiscal year deleted", `${settings.fiscalYear.code} and its associated records were permanently deleted.`);
    } catch (e) { Alert.alert("Unable to delete fiscal year", getErrorMessage(e)); }
    finally { setSaving(false); }
  }

  if (loading && !settings) return <ScreenLoader />;

  return (
    <>
      <ScrollView style={styles.settingsPage} contentContainerStyle={styles.settingsPageContent}>
      <View style={styles.settingsHeader}>
        <Text style={styles.sectionEyebrow}>APP PREFERENCES</Text>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.muted}>Manage application preferences and fiscal-year configuration.</Text>
        <SectionHeader title="Fiscal Year Management" />
        <Text style={styles.helperText}>Create fiscal years, configure tier eligibility, manage head limits, and export historical activity.</Text>
      </View>
      <View style={styles.settingsContent}>
        <View style={styles.createFiscalYearAction}>
          <PrimaryButton label="Create fiscal year" onPress={() => {
            setCode(""); setStartDate(""); setEndDate(""); setMaxTotalHeads(""); setRetentionMonths("3"); setDraftTiers(createDefaultDraftTiers()); setShowCreate(true);
          }} />
        </View>
        {fiscalYears.length ? (
          <>
            <FieldLabel text="Fiscal year" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearPicker}>
              {fiscalYears.map((fy) => (
                <TouchableOpacity key={fy.id} onPress={() => { setSelectedId(fy.id); void loadSettings(fy.id); }} style={[styles.yearChip, selectedId === fy.id && styles.yearChipActive]}>
                  <Text style={[styles.yearChipText, selectedId === fy.id && styles.yearChipTextActive]}>{fy.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {settings ? (
              <>
                <InfoCard>
                  <View style={styles.settingsSummaryCard}>
                    <View style={styles.settingsSummaryHeader}>
                      <View style={styles.settingsSummaryTitle}>
                        <Text style={styles.cardEyebrow}>FISCAL YEAR</Text>
                        <Text style={styles.cardTitle}>{settings.fiscalYear.code}</Text>
                      </View>
                      <StatusPill status={settings.fiscalYear.status} />
                    </View>
                    <View style={styles.settingsSummaryDetails}>
                      <Detail label="Start date" value={settings.fiscalYear.start_date} />
                      <Detail label="End date" value={settings.fiscalYear.end_date} />
                      <Detail label="Maximum total heads" value={settings.fiscalYear.max_total_heads == null ? "No limit" : String(settings.fiscalYear.max_total_heads)} />
                      <Detail label="Retention" value={`${settings.fiscalYear.retention_months ?? 3} months`} />
                    </View>
                    <View style={styles.settingsTierSummary}>
                      <Text style={styles.cardEyebrow}>TIER CONFIGURATION</Text>
                      {settings.tiers.map((tier) => (
                        <View key={tier.id} style={styles.settingsTierRow}>
                          <TierBadge tier={tier.tier_code} />
                          <Text style={styles.settingsTierDetail}>
                            {tier.loan_eligible ? `Loan eligible · ${tier.loan_limit_mode === "member_contribution" ? "Member contribution" : "Total contributions"}` : "Not eligible for loans"}
                          </Text>
                          <Text style={styles.settingsTierDetail}>Maximum heads per member: {tier.max_heads_per_member == null ? "No limit" : tier.max_heads_per_member}</Text>
                        </View>
                      ))}
                    </View>
                    <PrimaryButton label="Edit FY Settings" onPress={openEditSettings} disabled={saving} />
                    <View style={styles.actionRow}>
                      {settings.fiscalYear.status === "active" ? <ActionButton label="Close FY" secondary onPress={() => void changeStatus("close")} disabled={saving} /> : null}
                      <ActionButton label={exporting ? "Exporting…" : "Export Excel"} secondary onPress={() => void exportYear()} disabled={exporting} />
                    </View>
                    <ActionButton label="Delete fiscal year" danger onPress={() => { setDeleteConfirmation(""); setShowDelete(true); }} disabled={saving} />
                  </View>
                </InfoCard>
              </>
            ) : <EmptyState title="Select a fiscal year" message="Choose a fiscal year to configure its rules." />}
          </>
        ) : <View style={styles.fiscalYearEmptyWrap}><EmptyState title="No fiscal years" message="Create the next FY to start configuring tiers and head limits." /></View>}
      </View>
    </ScrollView>

      <Modal transparent visible={showCreate} animationType="none" onRequestClose={() => setShowCreate(false)}>
        <ModalSheet title="Create fiscal year" onClose={() => setShowCreate(false)}>
          <FieldLabel text="Fiscal year" />
          <TextInput keyboardType="numeric" onChangeText={setCode} placeholder="2027" placeholderTextColor="#94A3B8" style={styles.input} value={code} />
          <FieldLabel text="Start date" />
          <DatePickerField value={startDate} onChange={setStartDate} placeholder="Select start date" />
          <FieldLabel text="End date" />
          <DatePickerField value={endDate} onChange={setEndDate} placeholder="Select end date" />
          <FieldLabel text="Maximum total heads" />
          <TextInput keyboardType="numeric" onChangeText={setMaxTotalHeads} placeholder="Optional" placeholderTextColor="#94A3B8" style={styles.input} value={maxTotalHeads} />
                    <FieldLabel text="Historical retention after closing (months)" />
          <TextInput keyboardType="numeric" onChangeText={setRetentionMonths} style={styles.input} value={retentionMonths} />
          <Text style={styles.helperText}>Default is 3 months. Minimum retention is 3 months.</Text>
          <SectionHeader title="Configure Bronze, Silver, and Gold" />
          <Text style={styles.helperText}>Complete tier rules before creating this fiscal year. The new fiscal year will be active immediately.</Text>
          <View style={styles.draftTierList}>
            {draftTiers.map((tier, index) => <DraftTierSettingsCard key={tier.tierCode} tier={tier} onChange={(next) => setDraftTiers((current) => current.map((item, i) => i === index ? next : item))} />)}
          </View>
          <SectionHeader title="Review configuration" />
          <InfoCard>
            <View style={styles.reviewConfiguration}>
              <Text style={styles.cardTitle}>{code.trim() || "Fiscal year code not entered"}</Text>
              <Text style={styles.mutedSmall}>{startDate || "Start date"} → {endDate || "End date"}</Text>
              <Text style={styles.mutedSmall}>Retention: {retentionMonths || "3"} months after closure</Text>
              <View style={styles.reviewTierList}>
                {draftTiers.map((tier) => (
                  <View key={tier.tierCode} style={styles.reviewTierRow}>
                    <Text style={styles.reviewTierName}>{tier.displayName}</Text>
                    <Text style={styles.reviewTierDetail}>{tier.loanEligible ? "Loan eligible" : "Not loan eligible"}</Text>
                    {tier.loanEligible ? <Text style={styles.reviewTierDetail}>{tier.loanLimitMode === "member_contribution" ? "Member contribution" : "Total contributions"}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          </InfoCard>
          <PrimaryButton label="Create active fiscal year" loading={saving} onPress={() => void createYear()} />
        </ModalSheet>
      </Modal>
      <Modal transparent visible={showEditSettings} animationType="none" onRequestClose={() => setShowEditSettings(false)}>
        <ModalSheet title="Edit fiscal year settings" onClose={() => setShowEditSettings(false)}>
          <Text style={styles.modalLead}>Update the fiscal year details and all membership tier rules together. Changes are saved in one operation.</Text>
          <FieldLabel text="Fiscal year code" />
          <TextInput onChangeText={setCode} value={code} style={styles.input} placeholder="2027" placeholderTextColor="#94A3B8" />
          <FieldLabel text="Start date" />
          <DatePickerField value={startDate} onChange={setStartDate} placeholder="Select start date" />
          <FieldLabel text="End date" />
          <DatePickerField value={endDate} onChange={setEndDate} placeholder="Select end date" />
          <FieldLabel text="Maximum total heads" />
          <TextInput keyboardType="numeric" onChangeText={setMaxTotalHeads} value={maxTotalHeads} style={styles.input} placeholder="Leave blank for unlimited" placeholderTextColor="#94A3B8" />
          <FieldLabel text="Historical retention after closing (months)" />
          <TextInput keyboardType="numeric" onChangeText={setRetentionMonths} value={retentionMonths} style={styles.input} />
          <Text style={styles.helperText}>Minimum 3 months. Retention is fixed when the FY is activated.</Text>
          <SectionHeader title="Tier privileges" />
          <View style={styles.draftTierList}>
            {draftTiers.map((tier, index) => <DraftTierSettingsCard key={tier.tierCode} tier={tier} onChange={(next) => setDraftTiers((current) => current.map((item, i) => i === index ? next : item))} />)}
          </View>
          <PrimaryButton label="Save FY settings" loading={saving} onPress={() => void saveAllSettings()} />
        </ModalSheet>
      </Modal>
      <Modal transparent visible={showDelete} animationType="slide" onRequestClose={() => setShowDelete(false)}>
        <ModalSheet title="Delete fiscal year" onClose={() => setShowDelete(false)}>
          <Text style={styles.modalLead}>You are about to permanently delete FY {settings?.fiscalYear.code ?? ""}. This will delete the fiscal-year configuration, member assignments, and all records associated with this FY, including contributions, loan requests, loans, payment submissions, and audit history. Repayments linked to loans originated in this FY will also be deleted, even if a repayment was recorded in another FY. This action cannot be undone.</Text>
          <Text style={styles.deleteWarning}>Export the FY to Excel before deleting it if you need to keep an archive. The export button below opens the device sharing options.</Text>
          <ActionButton label={exporting ? "Exporting…" : "Export FY to Excel"} secondary onPress={() => void exportYear()} disabled={exporting || !settings} />
          <FieldLabel text={`Type DELETE FY ${settings?.fiscalYear.code ?? ""} to confirm`} />
          <TextInput autoCapitalize="characters" onChangeText={setDeleteConfirmation} value={deleteConfirmation} style={styles.input} placeholder={`DELETE FY ${settings?.fiscalYear.code ?? ""}`} placeholderTextColor="#94A3B8" />
          <PrimaryButton label="Permanently delete fiscal year" loading={saving} disabled={deleteConfirmation.trim() !== `DELETE FY ${settings?.fiscalYear.code ?? ""}`} onPress={() => void deleteYear()} />
        </ModalSheet>
      </Modal>
    </>
  );
}

function DatePickerField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const parse = (input: string) => {
    const parts = input.split("-").map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
  };
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(() => { const d = parse(value); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const selected = value ? parse(value) : null;
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => index - firstDay + 1);
  const format = (date: Date) => String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  return (
    <>
      <TouchableOpacity onPress={() => { const d = parse(value); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setVisible(true); }} style={[styles.input, { justifyContent: "center" }]}>
        <Text style={{ color: value ? DARK : "#94A3B8", fontSize: 14 }}>{value || placeholder}</Text>
      </TouchableOpacity>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModalCard}>
            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={styles.dateNavText}>‹</Text></TouchableOpacity>
              <Text style={styles.cardTitle}>{monthLabel}</Text>
              <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={styles.dateNavText}>›</Text></TouchableOpacity>
            </View>
            <View style={styles.calendarGrid}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((day) => <View key={day} style={styles.calendarCell}><Text style={styles.calendarWeekday}>{day}</Text></View>)}
              {cells.map((day, index) => {
                const valid = day >= 1 && day <= daysInMonth;
                const date = valid ? new Date(month.getFullYear(), month.getMonth(), day) : null;
                const active = Boolean(date && selected && date.getFullYear() === selected.getFullYear() && date.getMonth() === selected.getMonth() && date.getDate() === selected.getDate());
                return <View key={index} style={styles.calendarCell}>
                  <TouchableOpacity disabled={!valid} onPress={() => { if (date) onChange(format(date)); setVisible(false); }} style={[styles.calendarDay, active && styles.calendarDayActive]}>
                    <Text style={[styles.calendarDayText, !valid && styles.calendarDayMuted, active && styles.calendarDayTextActive]}>{valid ? day : ""}</Text>
                  </TouchableOpacity>
                </View>;
              })}
            </View>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.dateCancel}><Text style={styles.actionButtonTextSecondary}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

type DraftTier = {
  tierCode: "bronze" | "silver" | "gold"; displayName: string; enabled: boolean; maxHeadsPerMember: string;
  loanEligible: boolean; loanLimitMode: "member_contribution" | "total_contribution";
};
function createDefaultDraftTiers(): DraftTier[] {
  return [
    { tierCode: "bronze", displayName: "Bronze", enabled: true, maxHeadsPerMember: "", loanEligible: true, loanLimitMode: "member_contribution" },
    { tierCode: "silver", displayName: "Silver", enabled: true, maxHeadsPerMember: "", loanEligible: true, loanLimitMode: "member_contribution" },
    { tierCode: "gold", displayName: "Gold", enabled: true, maxHeadsPerMember: "", loanEligible: true, loanLimitMode: "total_contribution" },
  ];
}
function DraftTierSettingsCard({ tier, onChange }: { tier: DraftTier; onChange: (tier: DraftTier) => void }) {
  const patch = (values: Partial<DraftTier>) => onChange({ ...tier, enabled: true, ...values });
  return <InfoCard>
    <View style={styles.tierCardHeading}>
      <TierBadge tier={tier.tierCode} />
      <Text style={styles.tierCardSubtitle}>Membership tier</Text>
    </View>
    <TouchableOpacity onPress={() => patch({ loanEligible: !tier.loanEligible })} style={styles.toggleRow}><Text style={styles.cardTitle}>Loan eligibility</Text><Text style={styles.toggleText}>{tier.loanEligible ? "ON" : "OFF"}</Text></TouchableOpacity>
    {tier.loanEligible ? (
      <>
        <FieldLabel text="Maximum heads per member" />
        <TextInput keyboardType="numeric" value={tier.maxHeadsPerMember} onChangeText={(v) => patch({ maxHeadsPerMember: v })} placeholder="No tier-specific limit" placeholderTextColor="#94A3B8" style={styles.input} />
        <FieldLabel text="Loan limit mode" />
        <View style={styles.modePicker}>{(["member_contribution","total_contribution"] as const).map((mode) => <TouchableOpacity key={mode} onPress={() => patch({ loanLimitMode: mode })} style={[styles.modeOption, tier.loanLimitMode === mode && styles.modeOptionActive]}><Text style={[styles.modeOptionText, tier.loanLimitMode === mode && styles.modeOptionTextActive]}>{mode === "member_contribution" ? "Member contribution" : "Total contributions"}</Text></TouchableOpacity>)}</View>
        {tier.loanLimitMode === "member_contribution" ? <Text style={styles.helperText}>Loan limit is based on this member's paid contributions during the fiscal year.</Text> : <Text style={styles.helperText}>Loan limit is based on all paid contributions collected across the fiscal year.</Text>}
        
      </>
    ) : null}
  </InfoCard>;
}



function AccountScreen({ user, onSignOut }: { user: AuthenticatedUser; onSignOut: () => Promise<void> }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionEyebrow}>ACCOUNT</Text>
      <Text style={styles.pageTitle}>Your account</Text>
      <Text style={styles.muted}>Signed-in account and access details.</Text>

      <InfoCard>
        <Text style={styles.cardEyebrow}>SIGNED IN AS</Text>
        <Text style={styles.accountEmail}>{user.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{user.role === "admin" ? "Administrator" : "Member"}</Text>
        </View>
        <Text style={styles.note}>Your role is verified from the DLMSF member profile before protected app access is granted.</Text>
      </InfoCard>

      <TouchableOpacity style={styles.signOutButton} onPress={() => void onSignOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ErrorBox({ message }: { message: string }) {
  return <View style={styles.errorBox}><Text style={styles.errorText}>{message}</Text></View>;
}

function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={loading || disabled}
      onPress={onPress}
      style={[styles.primaryButton, (loading || disabled) && styles.disabledButton]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, secondary && styles.actionButtonSecondary, danger && styles.actionButtonDanger, disabled && styles.disabledButton]}
    >
      <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary, danger && styles.actionButtonTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function InfoCard({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.infoCard, style]}>{children}</View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const tone = statusTone(status);
  const colors = {
    blue: { bg: "#DBEAFE", text: "#1D4ED8" },
    green: { bg: "#DCFCE7", text: GREEN },
    red: { bg: "#FEE2E2", text: RED },
    amber: { bg: "#FEF3C7", text: AMBER },
    slate: { bg: "#E2E8F0", text: "#475569" },
  }[tone];
  return (
    <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{status || "Unknown"}</Text>
    </View>
  );
}

function ActivityRow({ title, detail, amount }: { title: string; detail: string; amount: string }) {
  return (
    <View style={styles.activityRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.mutedSmall}>{detail}</Text>
      </View>
      {amount ? <Text style={styles.activityAmount}>{amount}</Text> : null}
    </View>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function ScreenLoader() {
  return (
    <View style={styles.screenLoader}>
      <ActivityIndicator color={BLUE} />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.screenLoader}>
      <Text style={styles.errorStateTitle}>Unable to load</Text>
      <Text style={styles.errorStateMessage}>{message}</Text>
      <ActionButton label="Try again" onPress={onRetry} />
    </View>
  );
}

function ModalSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(36)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  function closeAnimated() {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 140, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 36, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }

  return (
    <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]}>
      <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={closeAnimated}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.modalContent, title === "Create fiscal year" && styles.createFiscalYearModalContent]}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

const styles = StyleSheet.create({
  toastProvider: { flex: 1 },
  toast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 58 : 42,
    left: theme.spacing.page,
    right: theme.spacing.page,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 9999,
  },
  toastIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  toastIconText: { fontSize: 15, fontWeight: "900" },
  toastMessage: { flex: 1, color: DARK, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  screen: { flex: 1, backgroundColor: BG },
  appShell: { flex: 1, backgroundColor: BG },
  content: { flex: 1, minHeight: 0, backgroundColor: BG },
  flex: { flex: 1 },
  authScroll: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 64 : 48, paddingBottom: 24 },
  authContainer: { width: "100%", maxWidth: 440, alignSelf: "center", flex: 1, justifyContent: "center" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BG },
  brandMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  brandInitials: { color: WHITE, fontSize: 21, fontWeight: "800", letterSpacing: 1 },
  eyebrow: { color: SLATE, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  authTitle: { color: DARK, fontSize: 34, lineHeight: 42, fontWeight: "800", letterSpacing: -0.8, marginTop: 7 },
  subtitle: { color: SLATE, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 28 },
  footer: { color: "#94A3B8", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 30 },
  card: { backgroundColor: WHITE, borderRadius: theme.radii.xl, padding: theme.spacing.xxl, borderWidth: 1, borderColor: BORDER, shadowColor: "#0F172A", shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  formTitle: { color: DARK, fontSize: 21, fontWeight: "800", marginBottom: 2 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: WHITE, paddingHorizontal: 15, color: DARK, fontSize: 14 },
  primaryButton: { minHeight: 52, borderRadius: theme.radii.md, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 16, shadowColor: BLUE, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: WHITE, fontSize: 14, fontWeight: "800" },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, borderRadius: 10, padding: 11, marginTop: 16 },
  errorText: { color: RED, fontSize: 12, lineHeight: 18 },
  loadingText: { color: SLATE, fontSize: 13, marginTop: 12 },
  topBar: { paddingTop: Platform.OS === "ios" ? 58 : NativeStatusBar.currentHeight ? NativeStatusBar.currentHeight + 16 : 34, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topEyebrow: { color: "#94A3B8", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  topTitle: { color: DARK, fontSize: 20, fontWeight: "800", marginTop: 3 },
  roleBadge: { backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  roleBadgeText: { color: "#1D4ED8", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  tabBar: { flexGrow: 0, backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: BORDER, elevation: 10, shadowColor: "#0F172A", shadowOpacity: 0.09, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } },
  tabBarScroll: { paddingHorizontal: 6, paddingBottom: Platform.OS === "ios" ? 26 : 14, paddingTop: 10, minHeight: Platform.OS === "ios" ? 74 : 66 },
  tabButton: { minWidth: 88, minHeight: 50, alignItems: "center", justifyContent: "center", paddingVertical: 13, paddingHorizontal: 9, borderRadius: 12 },
  tabLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "800" },
  tabLabelActive: { color: BLUE },
  scrollContent: { paddingHorizontal: theme.spacing.page, paddingTop: 22, paddingBottom: 40, gap: theme.spacing.lg },
  listContent: { paddingHorizontal: theme.spacing.page, paddingTop: 22, paddingBottom: 40 },
  memberListContent: { paddingHorizontal: theme.spacing.page, paddingTop: 22, paddingBottom: 40 },
  memberCardSeparator: { height: theme.spacing.lg },
  cardSeparator: { height: theme.spacing.lg },
  memberCardBody: { gap: theme.spacing.md },
  memberTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.md },
  memberIdentity: { flex: 1, gap: theme.spacing.xs },
  memberContributionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md },
  weeklyContribution: { alignItems: "flex-end", gap: 2 },
  weeklyContributionLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  weeklyContributionValue: { color: DARK, fontSize: 14, fontWeight: "900" },
  sectionEyebrow: { color: "#94A3B8", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  pageTitle: { color: DARK, fontSize: 29, lineHeight: 36, fontWeight: "800", letterSpacing: -0.65, marginTop: 6 },
  muted: { color: SLATE, fontSize: 13, lineHeight: 20, marginTop: 5 },
  mutedSmall: { color: SLATE, fontSize: 11, marginTop: 4 },
  welcomeRow: { flexDirection: "row", alignItems: "flex-start" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: theme.spacing.md, marginTop: theme.spacing.sm },
  statCardInner: { flex: 1 },
  statLabel: { color: SLATE, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  statValue: { color: DARK, fontSize: 20, fontWeight: "800", marginTop: 7 },
  statCard: { backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, margin: 0, width: "48%", minHeight: 88, justifyContent: "center", shadowColor: "#0F172A", shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionHeader: { color: DARK, fontSize: 17, fontWeight: "800", marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
  heroCard: { backgroundColor: BLUE, borderRadius: 18, padding: 21, marginTop: 0 },
  heroValue: { color: WHITE, fontSize: 34, fontWeight: "900", marginTop: 5 },
  heroSub: { color: "#DBEAFE", fontSize: 12, marginTop: 3 },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.24)", marginVertical: 18 },
  heroLabel: { color: "#DBEAFE", fontSize: 11, fontWeight: "700" },
  heroLabelValue: { color: WHITE, fontSize: 13, fontWeight: "800" },
  inlineStat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoCard: { backgroundColor: WHITE, borderRadius: theme.radii.xl, borderWidth: 1, borderColor: BORDER, padding: theme.spacing.card, marginBottom: 0, gap: theme.spacing.sm, shadowColor: "#0F172A", shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  reviewConfiguration: { gap: 10 },
  reviewTierList: { gap: 10, marginTop: 4 },
  reviewTierRow: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, gap: 4 },
  reviewTierName: { color: DARK, fontSize: 12, fontWeight: "800" },
  reviewTierDetail: { color: SLATE, fontSize: 11, lineHeight: 17 },
  cardEyebrow: { color: "#94A3B8", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  cardTitle: { color: DARK, fontSize: 14, fontWeight: "800" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 15, marginHorizontal: -4 },
  detailItem: { width: "50%", padding: 4 },
  detailLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  detailValue: { color: DARK, fontSize: 13, fontWeight: "800", marginTop: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  activityRow: { backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 15, marginBottom: 0, flexDirection: "row", alignItems: "center", minHeight: 66 },
  activityAmount: { color: DARK, fontSize: 13, fontWeight: "800" },
  emptyState: { backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 24, alignItems: "center", marginBottom: 0, width: "100%" },
  emptyTitle: { color: DARK, fontSize: 13, fontWeight: "800" },
  emptyMessage: { color: SLATE, fontSize: 11, textAlign: "center", marginTop: 5, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  memberAddAction: { marginTop: theme.spacing.md, marginBottom: theme.spacing.md },
  actionButton: { flex: 1, minHeight: 48, backgroundColor: BLUE, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  actionButtonSecondary: { backgroundColor: WHITE, borderWidth: 1, borderColor: "#CBD5E1" },
  actionButtonDanger: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  actionButtonText: { color: WHITE, fontSize: 11, fontWeight: "800", textAlign: "center" },
  actionButtonTextSecondary: { color: "#1D4ED8" },
  actionButtonTextDanger: { color: RED },
  helperText: { color: SLATE, fontSize: 11, lineHeight: 17, marginTop: 9 },
  tierMeta: { color: SLATE, fontSize: 10, fontWeight: "700", marginTop: 5 },
  memberTierLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 0 },
  tierBadge: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tierBadgeMark: { fontSize: 9, fontWeight: "900", marginRight: 5 },
  tierBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  tierBadgeDetail: { fontSize: 9, fontWeight: "700" },
  settingsCard: { backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 17, marginTop: 0, marginBottom: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  settingsIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  settingsIconText: { color: "#1D4ED8", fontSize: 12, fontWeight: "900" },
  settingsCardBody: { flex: 1 },
  settingsMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 9, gap: 6 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  settingsMetaText: { color: "#166534", fontSize: 10, fontWeight: "700" },
  settingsRequiredText: { color: AMBER, fontSize: 10, fontWeight: "700", marginTop: 8 },
  settingsChevron: { color: SLATE, fontSize: 26, fontWeight: "300" },
  fyRequiredIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  fyRequiredIconText: { color: "#1D4ED8", fontSize: 18, fontWeight: "900" },
  tierPicker: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs, alignItems: "stretch" },
  tierOption: { flex: 1, minHeight: 50, borderRadius: 9, borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", backgroundColor: WHITE, paddingHorizontal: 4 },
  tierOptionActive: { borderColor: BLUE, backgroundColor: "#EFF6FF" },
  tierOptionContent: { width: "100%", alignItems: "center", justifyContent: "center" },
  tierOptionText: { color: SLATE, fontSize: 11, fontWeight: "800" },
  tierOptionTextActive: { color: "#1D4ED8" },
  fullModalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  fullModalSheet: { height: "94%", backgroundColor: BG, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  settingsPage: { flex: 1 },
  settingsPageContent: { paddingBottom: 40 },
  settingsHeader: { paddingHorizontal: theme.spacing.page, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm, gap: theme.spacing.xs },
  settingsContent: { paddingHorizontal: theme.spacing.page, paddingTop: theme.spacing.sm, paddingBottom: 8, gap: theme.spacing.lg },
  settingsSummaryCard: { gap: theme.spacing.lg },
  settingsSummaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingsSummaryTitle: { flex: 1, gap: 5 },
  settingsSummaryDetails: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, paddingTop: 4 },
  settingsTierSummary: { gap: theme.spacing.sm, paddingTop: theme.spacing.lg, borderTopWidth: 1, borderTopColor: BORDER },
  settingsTierRow: { gap: 6, paddingVertical: 3 },
  settingsTierDetail: { color: SLATE, fontSize: 11, lineHeight: 17 },
  deleteWarning: { color: AMBER, fontSize: 12, lineHeight: 18, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12 },
  createFiscalYearAction: { marginBottom: 0 },
  fiscalYearEmptyWrap: { marginTop: 2, paddingTop: 4 },
  yearPicker: { gap: 12, paddingVertical: 10, paddingHorizontal: 2 },
  yearChip: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: WHITE },
  yearChipActive: { backgroundColor: "#EFF6FF", borderColor: BLUE },
  yearChipText: { color: SLATE, fontSize: 11, fontWeight: "800" },
  yearChipTextActive: { color: "#1D4ED8" },
  toggleRow: { marginTop: 12, minHeight: 44, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: "#F8FAFC", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleRowCompact: { borderWidth: 1, borderColor: BORDER, borderRadius: 18, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#F8FAFC" },
  toggleText: { color: BLUE, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  modePicker: { flexDirection: "row", gap: 6, marginTop: 2 },
  modeOption: { flex: 1, minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", backgroundColor: WHITE, paddingHorizontal: 5 },
  modeOptionActive: { backgroundColor: "#EFF6FF", borderColor: BLUE },
  modeOptionText: { color: SLATE, fontSize: 9, fontWeight: "800", textAlign: "center" },
  modeOptionTextActive: { color: "#1D4ED8" },
  note: { color: SLATE, fontSize: 11, lineHeight: 17, marginTop: 13, backgroundColor: "#F8FAFC", padding: 10, borderRadius: 8 },
  segment: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4, marginTop: 20, marginBottom: 16 },
  segmentButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  segmentActive: { backgroundColor: WHITE },
  segmentText: { color: SLATE, fontSize: 11, fontWeight: "800" },
  segmentTextActive: { color: BLUE },
  reviewActions: { marginTop: 14, flexDirection: "row" },
  rejectButton: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 9, minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  rejectText: { color: "#1D4ED8", fontSize: 11, fontWeight: "800" },
  memberActions: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "center", paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: BORDER },
  memberActionButton: { flex: 1, minHeight: 42, backgroundColor: "#EFF6FF", borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, paddingVertical: 8 },
  memberActionButtonDelete: { flex: 1, minHeight: 42, backgroundColor: "#FEF2F2", borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, paddingVertical: 8 },
  smallAction: { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  smallActionText: { color: "#1D4ED8", fontSize: 10, fontWeight: "800" },
  smallDelete: { backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  smallDeleteText: { color: RED, fontSize: 10, fontWeight: "800" },
  accountEmail: { color: DARK, fontSize: 16, fontWeight: "800", marginTop: 8 },
  rolePill: { alignSelf: "flex-start", backgroundColor: "#DBEAFE", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginTop: 14 },
  roleText: { color: "#1D4ED8", fontSize: 10, fontWeight: "900" },
  signOutButton: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: WHITE, alignItems: "center", justifyContent: "center", marginTop: 10 },
  signOutText: { color: RED, fontSize: 13, fontWeight: "800" },
  screenLoader: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  errorStateTitle: { color: DARK, fontSize: 18, fontWeight: "800" },
  errorStateMessage: { color: SLATE, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 8, marginBottom: 10 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalKeyboard: { width: "100%" },
  modalSheet: { maxHeight: "90%", marginBottom: 10, backgroundColor: WHITE, borderRadius: theme.radii.xxl, overflow: "hidden", paddingBottom: Platform.OS === "ios" ? 26 : 18 },
  modalHeader: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: DARK, fontSize: 19, fontWeight: "800" },
  closeText: { color: BLUE, fontSize: 12, fontWeight: "800" },
  modalContent: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, paddingBottom: 34, gap: theme.spacing.md },
  createFiscalYearModalContent: { gap: theme.spacing.lg },
  draftTierList: { gap: theme.spacing.lg },
  tierCardHeading: { gap: 6 },
  tierCardSubtitle: { color: SLATE, fontSize: 10, fontWeight: "700" },
  modalLead: { color: SLATE, fontSize: 13, lineHeight: 20, marginTop: 4 },
  dateModalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.48)", justifyContent: "center", padding: 22 },
  dateModalCard: { backgroundColor: WHITE, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, shadowColor: "#0F172A", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  dateNavText: { color: BLUE, fontSize: 30, fontWeight: "700", paddingHorizontal: 12 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14 },
  calendarCell: { width: "14.2857%", alignItems: "center", justifyContent: "center", paddingVertical: 3 },
  calendarWeekday: { color: SLATE, fontSize: 10, fontWeight: "800" },
  calendarDay: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  calendarDayActive: { backgroundColor: BLUE },
  calendarDayText: { color: DARK, fontSize: 12, fontWeight: "600" },
  calendarDayTextActive: { color: WHITE, fontWeight: "900" },
  calendarDayMuted: { color: "transparent" },
  dateCancel: { alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },

});


export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
