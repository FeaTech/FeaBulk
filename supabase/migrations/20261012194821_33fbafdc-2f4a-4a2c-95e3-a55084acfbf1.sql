CREATE OR REPLACE FUNCTION public.enforce_simplified_roles()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'organization_members' OR TG_TABLE_NAME = 'organization_invitations' THEN
    IF NEW.role::text NOT IN ('owner','administrator') THEN
      NEW.role := 'administrator';
    END IF;
  ELSIF TG_TABLE_NAME = 'operations_members' THEN
    NEW.role := 'platform_administrator';
  ELSIF TG_TABLE_NAME = 'organizations' THEN
    IF NEW.kind::text = 'both' THEN
      RAISE EXCEPTION 'A business must be either a buyer or a seller';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_simplified_roles_org_members BEFORE INSERT OR UPDATE OF role ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.enforce_simplified_roles();
CREATE TRIGGER enforce_simplified_roles_invitations BEFORE INSERT OR UPDATE OF role ON public.organization_invitations FOR EACH ROW EXECUTE FUNCTION public.enforce_simplified_roles();
CREATE TRIGGER enforce_simplified_roles_ops BEFORE INSERT OR UPDATE OF role ON public.operations_members FOR EACH ROW EXECUTE FUNCTION public.enforce_simplified_roles();
CREATE TRIGGER enforce_simplified_roles_orgs BEFORE INSERT OR UPDATE OF kind ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.enforce_simplified_roles();