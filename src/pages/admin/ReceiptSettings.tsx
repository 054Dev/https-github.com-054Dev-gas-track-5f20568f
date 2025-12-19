import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Save, Receipt, Plus, Trash2 } from "lucide-react";
import { ReceiptViewer } from "@/components/ReceiptViewer";

interface ReceiptTemplateSettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  footer_text: string | null;
  show_transaction_id: boolean;
  show_payment_method: boolean;
  custom_field_1_label: string | null;
  custom_field_1_value: string | null;
  custom_field_2_label: string | null;
  custom_field_2_value: string | null;
  custom_field_3_label: string | null;
  custom_field_3_value: string | null;
}

export default function ReceiptSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReceiptTemplateSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("receipt_template_settings")
        .select("*")
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load receipt settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("receipt_template_settings")
        .update({
          company_name: settings.company_name,
          logo_url: settings.logo_url,
          footer_text: settings.footer_text,
          show_transaction_id: settings.show_transaction_id,
          show_payment_method: settings.show_payment_method,
          custom_field_1_label: settings.custom_field_1_label,
          custom_field_1_value: settings.custom_field_1_value,
          custom_field_2_label: settings.custom_field_2_label,
          custom_field_2_value: settings.custom_field_2_value,
          custom_field_3_label: settings.custom_field_3_label,
          custom_field_3_value: settings.custom_field_3_value,
        })
        .eq("id", settings.id);

      if (error) throw error;
      toast.success("Receipt template saved successfully");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save receipt settings");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ReceiptTemplateSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const clearCustomField = (fieldNum: 1 | 2 | 3) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [`custom_field_${fieldNum}_label`]: null,
      [`custom_field_${fieldNum}_value`]: null,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4">
        <div className="container mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Receipt Template Settings</h1>
          </div>
          <Button className="ml-auto" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 grid lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Customize your company details on receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings?.company_name || ""}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="Your Company Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  value={settings?.logo_url || ""}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a URL to your company logo (recommended size: 100x100px)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Display Options */}
          <Card>
            <CardHeader>
              <CardTitle>Display Options</CardTitle>
              <CardDescription>Choose what information to show on receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Transaction ID</Label>
                  <p className="text-sm text-muted-foreground">Display the transaction reference</p>
                </div>
                <Switch
                  checked={settings?.show_transaction_id ?? true}
                  onCheckedChange={(checked) => updateField("show_transaction_id", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Payment Method</Label>
                  <p className="text-sm text-muted-foreground">Display how the payment was made</p>
                </div>
                <Switch
                  checked={settings?.show_payment_method ?? true}
                  onCheckedChange={(checked) => updateField("show_payment_method", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Custom Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>Add up to 3 custom fields to your receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3].map((num) => {
                const labelKey = `custom_field_${num}_label` as keyof ReceiptTemplateSettings;
                const valueKey = `custom_field_${num}_value` as keyof ReceiptTemplateSettings;
                const hasValue = settings?.[labelKey] || settings?.[valueKey];
                
                return (
                  <div key={num} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Custom Field {num}</span>
                      {hasValue && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearCustomField(num as 1 | 2 | 3)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={(settings?.[labelKey] as string) || ""}
                          onChange={(e) => updateField(labelKey, e.target.value || null)}
                          placeholder="e.g., Tax ID"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Value</Label>
                        <Input
                          value={(settings?.[valueKey] as string) || ""}
                          onChange={(e) => updateField(valueKey, e.target.value || null)}
                          placeholder="e.g., 12345678"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Footer */}
          <Card>
            <CardHeader>
              <CardTitle>Footer Text</CardTitle>
              <CardDescription>Custom message at the bottom of receipts</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings?.footer_text || ""}
                onChange={(e) => updateField("footer_text", e.target.value)}
                placeholder="Thank you for your business!"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-4 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>See how your receipt will look</CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptViewer
                customerName="Sample Customer"
                amount={5000}
                method="mpesa"
                date={new Date().toISOString()}
                transactionId="TXN123456789"
                status="completed"
                templateSettings={settings ? {
                  companyName: settings.company_name,
                  logoUrl: settings.logo_url,
                  footerText: settings.footer_text,
                  showTransactionId: settings.show_transaction_id,
                  showPaymentMethod: settings.show_payment_method,
                  customFields: [
                    settings.custom_field_1_label && settings.custom_field_1_value
                      ? { label: settings.custom_field_1_label, value: settings.custom_field_1_value }
                      : null,
                    settings.custom_field_2_label && settings.custom_field_2_value
                      ? { label: settings.custom_field_2_label, value: settings.custom_field_2_value }
                      : null,
                    settings.custom_field_3_label && settings.custom_field_3_value
                      ? { label: settings.custom_field_3_label, value: settings.custom_field_3_value }
                      : null,
                  ].filter(Boolean) as { label: string; value: string }[],
                } : undefined}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
