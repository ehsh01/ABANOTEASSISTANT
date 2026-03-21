import { Link, Redirect } from "wouter";
import {
  useListAdminCompanies,
  usePatchAdminCompany,
  type AdminCompany,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();

  const listQuery = useListAdminCompanies({
    query: {
      enabled: !!token && user?.role === "super_admin",
      queryKey: ["/api/admin/companies", token, user?.role],
    },
  });

  const patchMutation = usePatchAdminCompany({
    mutation: {
      onSuccess: () => {
        listQuery.refetch();
        toast({ title: "Updated company access" });
      },
      onError: (err: Error & { data?: { error?: string } }) => {
        toast({
          title: "Update failed",
          description: err?.data?.error ?? err.message,
          variant: "destructive",
        });
      },
    },
  });

  if (!token) {
    return <Redirect to="/login" />;
  }

  if (user?.role !== "super_admin") {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Super admin</h1>
            <p className="text-muted-foreground text-sm">All companies and complimentary access</p>
          </div>
          <Link href="/">
            <Button variant="outline" type="button">
              Back to app
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>
              Toggle &quot;Complimentary access&quot; for organizations that should not be blocked when{" "}
              <code className="text-xs">ENFORCE_COMPLIMENTARY_ACCESS</code> is enabled on the API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : listQuery.isError ? (
              <p className="text-sm text-destructive">Could not load companies.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Complimentary access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data?.data.map((c: AdminCompany) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.id}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.userCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={c.freeUsage}
                            disabled={patchMutation.isPending}
                            onCheckedChange={(checked) => {
                              patchMutation.mutate({
                                companyId: c.id,
                                data: { freeUsage: checked },
                              });
                            }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {c.freeUsage ? "On" : "Off"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
