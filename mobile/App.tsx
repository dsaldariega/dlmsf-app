import { useEffect, useState, type ReactNode } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./lib/supabase";
import { getMemberRole, type MemberRole } from "./lib/auth";
import { apiRequest, ApiError } from "./lib/api";
import { currency, dateLabel, shortDate, statusTone, wholeCurrency } from "./lib/format";

type AuthenticatedUser = { id: string; email: string; role: MemberRole };
type Tab = "home" | "loans" | "payments" | "requests" | "audit" | "members" | "account";

type Dashboard = {
  member?: { id: number; name: string; heads: number };
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

const BLUE = "#2563EB";
const DARK = "#1E293B";
const SLATE = "#64748B";
const BORDER = "#E2E8F0";
const BG = "#F1F5F9";
const WHITE = "#FFFFFF";
const GREEN = "#15803D";
const RED = "#B91C1C";
const AMBER = "#B45309";

export default function App() {
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
  const [tab, setTab] = useState<Tab>(user.role === "admin" ? "home" : "home");
  const [refreshKey, setRefreshKey] = useState(0);

  function refreshAll() {
    setRefreshKey((value) => value + 1);
  }

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
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user.role === "admin" ? "ADMIN" : "MEMBER"}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {tab === "home" && <HomeScreen user={user} refreshKey={refreshKey} onNavigate={setTab} />}
        {tab === "loans" && (user.role === "admin" ? <AdminLoansScreen refreshKey={refreshKey} onChanged={refreshAll} /> : <MemberLoansScreen refreshKey={refreshKey} onChanged={refreshAll} />)}
        {tab === "payments" && (user.role === "admin" ? <AdminPaymentsScreen refreshKey={refreshKey} onChanged={refreshAll} /> : <MemberPaymentsScreen refreshKey={refreshKey} onChanged={refreshAll} />)}
        
        {tab === "audit" && <AdminAuditScreen refreshKey={refreshKey} onChanged={refreshAll} />}
        {tab === "members" && <AdminMembersScreen refreshKey={refreshKey} onChanged={refreshAll} />}
        {tab === "account" && <AccountScreen user={user} onSignOut={onSignOut} />}
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

      <SectionHeader title="Quick actions" />
      <View style={styles.actionRow}>
        <ActionButton label="Review Requests" onPress={() => onNavigate("requests")} />
        <ActionButton label="Members" secondary onPress={() => onNavigate("members")} />
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

      <Modal transparent visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
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
      const [loanData, memberData] = await Promise.all([
        apiRequest<any[]>("/api/loans"),
        apiRequest<Member[]>("/api/members"),
      ]);
      setLoans(loanData);
      setMembers(memberData);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
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
            await apiRequest(`/api/audit/${type === "loans" ? "loans" : "payments"}/${record.id}`, { method: "DELETE" });
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
          {!item.synthetic ? <TouchableOpacity style={styles.smallDelete} onPress={() => void removeRecord(tab, item)}><Text style={styles.smallDeleteText}>Delete audit entry</Text></TouchableOpacity> : null}
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

function AdminMembersScreen({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [heads, setHeads] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [refreshKey]);

  async function load(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      setMembers(await apiRequest<Member[]>("/api/members"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreate() {
    setSelected(null);
    setName("");
    setHeads("1");
    setModal("create");
  }

  function openEdit(member: Member) {
    setSelected(member);
    setName(member.name);
    setHeads(String(member.heads));
    setModal("edit");
  }

  async function saveMember() {
    const trimmed = name.trim();
    const headCount = Number(heads);
    if (!trimmed || !Number.isInteger(headCount) || headCount < 1) {
      Alert.alert("Invalid member", "Enter a name and a whole number of heads.");
      return;
    }

    setSaving(true);
    try {
      if (modal === "create") {
        const result = await apiRequest<{ member: Member; loginEmail: string; temporaryPassword: string }>("/api/members", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, heads: headCount }),
        });
        setModal(null);
        Alert.alert(
          "Member created",
          `Login: ${result.loginEmail}\nTemporary password: ${result.temporaryPassword}\n\nShare these credentials securely with the member.`,
        );
      } else if (selected) {
        await apiRequest(`/api/members/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: trimmed, heads: headCount }),
        });
        setModal(null);
        Alert.alert("Member updated", "The member profile has been updated.");
      }
      onChanged();
    } catch (e) {
      Alert.alert("Unable to save", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(member: Member) {
    Alert.alert(
      "Delete member?",
      `This will delete ${member.name} and the linked login. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/api/members/${member.id}`, { method: "DELETE" });
              Alert.alert("Deleted", "The member and linked login were deleted.");
              onChanged();
            } catch (e) {
              Alert.alert("Unable to delete", getErrorMessage(e));
            }
          },
        },
      ],
    );
  }

  if (loading && !members.length) return <ScreenLoader />;
  if (error && !members.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={styles.flex}>
      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={BLUE} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionEyebrow}>MEMBERS</Text>
            <Text style={styles.pageTitle}>Member accounts</Text>
            <Text style={styles.muted}>Manage member profiles and linked logins.</Text>
            <PrimaryButton label="Add member" onPress={openCreate} />
          </View>
        }
        renderItem={({ item }) => (
          <InfoCard>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.mutedSmall}>{item.heads} head{item.heads === 1 ? "" : "s"} · Member #{item.id}</Text>
              </View>
              <View style={styles.memberActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.smallAction}><Text style={styles.smallActionText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.smallDelete}><Text style={styles.smallDeleteText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          </InfoCard>
        )}
        ListEmptyComponent={<EmptyState title="No members" message="Member accounts will appear here." />}
      />

      <Modal transparent visible={Boolean(modal)} animationType="slide" onRequestClose={() => setModal(null)}>
        <ModalSheet title={modal === "create" ? "Add member" : "Edit member"} onClose={() => setModal(null)}>
          <FieldLabel text="Name" />
          <TextInput onChangeText={setName} placeholder="Member name" placeholderTextColor="#94A3B8" style={styles.input} value={name} />
          <FieldLabel text="Heads" />
          <TextInput keyboardType="numeric" onChangeText={setHeads} placeholder="1" placeholderTextColor="#94A3B8" style={styles.input} value={heads} />
          {modal === "create" ? <Text style={styles.helperText}>A linked Supabase login will be created automatically using the existing backend account workflow.</Text> : null}
          <PrimaryButton label={modal === "create" ? "Create member" : "Save changes"} loading={saving} onPress={() => void saveMember()} />
        </ModalSheet>
      </Modal>
    </View>
  );
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
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={loading || disabled}
      onPress={onPress}
      style={[styles.primaryButton, (loading || disabled) && styles.disabledButton]}
    >
      {loading ? <ActivityIndicator color={WHITE} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, secondary && styles.actionButtonSecondary, disabled && styles.disabledButton]}
    >
      <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]}>{label}</Text>
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

function InfoCard({ children }: { children: ReactNode }) {
  return <View style={styles.infoCard}>{children}</View>;
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
  return (
    <View style={styles.modalBackdrop}>
      <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

const styles = StyleSheet.create({
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
  card: { backgroundColor: WHITE, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: BORDER },
  formTitle: { color: DARK, fontSize: 21, fontWeight: "800", marginBottom: 2 },
  label: { color: "#334155", fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  input: { height: 50, borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: WHITE, paddingHorizontal: 14, color: DARK, fontSize: 14 },
  primaryButton: { minHeight: 50, borderRadius: 10, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 20 },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: WHITE, fontSize: 14, fontWeight: "800" },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, borderRadius: 10, padding: 11, marginTop: 16 },
  errorText: { color: RED, fontSize: 12, lineHeight: 18 },
  loadingText: { color: SLATE, fontSize: 13, marginTop: 12 },
  topBar: { paddingTop: Platform.OS === "ios" ? 58 : NativeStatusBar.currentHeight ? NativeStatusBar.currentHeight + 16 : 34, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topEyebrow: { color: "#94A3B8", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  topTitle: { color: DARK, fontSize: 20, fontWeight: "800", marginTop: 3 },
  roleBadge: { backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  roleBadgeText: { color: "#1D4ED8", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  tabBar: { flexGrow: 0, backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: BORDER, elevation: 8, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } },
  tabBarScroll: { paddingHorizontal: 4, paddingBottom: Platform.OS === "ios" ? 20 : 8, paddingTop: 8 },
  tabButton: { minWidth: 78, alignItems: "center", paddingVertical: 8, paddingHorizontal: 6 },
  tabLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  tabLabelActive: { color: BLUE },
  scrollContent: { padding: 20, paddingBottom: 24 },
  listContent: { padding: 20, paddingBottom: 24 },
  sectionEyebrow: { color: "#94A3B8", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  pageTitle: { color: DARK, fontSize: 29, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5, marginTop: 5 },
  muted: { color: SLATE, fontSize: 13, lineHeight: 20, marginTop: 5 },
  mutedSmall: { color: SLATE, fontSize: 11, marginTop: 4 },
  welcomeRow: { flexDirection: "row", alignItems: "flex-start" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginTop: 18 },
  statCardInner: { flex: 1 },
  statLabel: { color: SLATE, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  statValue: { color: DARK, fontSize: 20, fontWeight: "800", marginTop: 7 },
  statCard: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, margin: 5, width: "46%" },
  sectionHeader: { color: DARK, fontSize: 17, fontWeight: "800", marginTop: 24, marginBottom: 11 },
  heroCard: { backgroundColor: BLUE, borderRadius: 18, padding: 20, marginTop: 18 },
  heroValue: { color: WHITE, fontSize: 34, fontWeight: "900", marginTop: 5 },
  heroSub: { color: "#DBEAFE", fontSize: 12, marginTop: 3 },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.24)", marginVertical: 18 },
  heroLabel: { color: "#DBEAFE", fontSize: 11, fontWeight: "700" },
  heroLabelValue: { color: WHITE, fontSize: 13, fontWeight: "800" },
  inlineStat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoCard: { backgroundColor: WHITE, borderRadius: 15, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 11 },
  cardEyebrow: { color: "#94A3B8", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  cardTitle: { color: DARK, fontSize: 14, fontWeight: "800" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 15, marginHorizontal: -4 },
  detailItem: { width: "50%", padding: 4 },
  detailLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  detailValue: { color: DARK, fontSize: 13, fontWeight: "800", marginTop: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  activityRow: { backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  activityAmount: { color: DARK, fontSize: 13, fontWeight: "800" },
  emptyState: { backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 18, alignItems: "center", marginBottom: 10 },
  emptyTitle: { color: DARK, fontSize: 13, fontWeight: "800" },
  emptyMessage: { color: SLATE, fontSize: 11, textAlign: "center", marginTop: 5, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionButton: { flex: 1, minHeight: 46, backgroundColor: BLUE, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  actionButtonSecondary: { backgroundColor: WHITE, borderWidth: 1, borderColor: "#CBD5E1" },
  actionButtonText: { color: WHITE, fontSize: 11, fontWeight: "800", textAlign: "center" },
  actionButtonTextSecondary: { color: "#1D4ED8" },
  helperText: { color: SLATE, fontSize: 11, lineHeight: 17, marginTop: 9 },
  note: { color: SLATE, fontSize: 11, lineHeight: 17, marginTop: 13, backgroundColor: "#F8FAFC", padding: 10, borderRadius: 8 },
  segment: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 10, padding: 3, marginTop: 18, marginBottom: 14 },
  segmentButton: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  segmentActive: { backgroundColor: WHITE },
  segmentText: { color: SLATE, fontSize: 11, fontWeight: "800" },
  segmentTextActive: { color: BLUE },
  reviewActions: { marginTop: 14, flexDirection: "row" },
  rejectButton: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 9, minHeight: 40, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  rejectText: { color: "#1D4ED8", fontSize: 11, fontWeight: "800" },
  memberActions: { flexDirection: "row", gap: 7 },
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
  modalSheet: { maxHeight: "88%", backgroundColor: WHITE, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: Platform.OS === "ios" ? 26 : 14 },
  modalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: DARK, fontSize: 19, fontWeight: "800" },
  closeText: { color: BLUE, fontSize: 12, fontWeight: "800" },
  modalContent: { padding: 20, paddingBottom: 28 },
  modalLead: { color: SLATE, fontSize: 13, lineHeight: 20, marginTop: 4 },
});
