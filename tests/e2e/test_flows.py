"""Main user flows in a real browser (demo account, nothing is sent anywhere).

Run:  pip install -r tests/e2e/requirements.txt && playwright install chromium
      python -m pytest tests/e2e -v
"""
import datetime as dt
import re

from playwright.sync_api import Page, expect


def iso(days):
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


def start_demo(page: Page, base_url):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    expect(page.get_by_role("heading", name="Decide before you’re charged.")).to_be_visible()
    page.get_by_role("button", name="Skip").click()
    expect(page).to_have_url(re.compile(r"#/dashboard$"))


def pick_date(page: Page, field_id, day_iso):
    page.locator(f"#{field_id}").click()
    cell = page.locator(f'[data-d="{day_iso}"]')
    for _ in range(3):  # the date may be in the next month
        if cell.count() and cell.first.is_visible():
            break
        page.get_by_role("button", name="Next month").click()
    cell.first.click()


def add_reminder(page: Page, name, amount="12.50", days=20, note=""):
    page.goto(page.url.split("#")[0] + "#/new")
    page.locator(".chip", has_text="Enter manually").click()
    page.locator("#f-name").fill(name)
    page.locator("#f-amount").fill(amount)
    pick_date(page, "f-date", iso(days))
    if note:
        page.locator("#f-note").fill(note)
    page.get_by_role("button", name="Save reminder").click()
    dialog = page.get_by_role("dialog", name=re.compile("Added"))
    expect(dialog).to_be_visible()
    return dialog


def row(page: Page, name):
    return page.locator(".rrow", has_text=name)


def find(page: Page, name):
    """Switch to the list view (the calendar shows one month) and search."""
    page.goto(page.url.split("#")[0] + "#/reminders")
    page.get_by_role("radio", name="List view").click()
    page.get_by_placeholder(re.compile("Search", re.I)).first.fill(name)
    return row(page, name)


def open_details(page: Page, name):
    find(page, name).first.click()
    drawer = page.get_by_role("dialog", name=name)
    expect(drawer).to_be_visible()
    return drawer


# ---------------------------------------------------------------- tests

def test_login_screen_offers_google_and_demo(page: Page, base_url, errors):
    page.goto(base_url + "/")
    expect(page.get_by_role("heading", name="Log in")).to_be_visible()
    expect(page.get_by_role("button", name="Continue with Google")).to_be_visible()
    expect(page.get_by_role("button", name="Try the demo without signing up")).to_be_visible()


def test_onboarding_adds_picked_services(page: Page, base_url, errors):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    page.get_by_role("button", name="Next").click()
    expect(page.get_by_role("heading", name=re.compile("Can’t decide now"))).to_be_visible()
    page.get_by_role("button", name="Next").click()
    expect(page.get_by_text("3 selected")).to_be_visible()  # the demo suggests three
    page.locator('[aria-labelledby="svc-l"] .chip').first.click()
    expect(page.get_by_text("2 selected")).to_be_visible()
    page.get_by_role("button", name="Add 2 services").click()
    expect(page).to_have_url(re.compile(r"#/dashboard$"))
    expect(page.get_by_role("status").get_by_text(re.compile("added to your list|already in the list"))).to_be_visible()


def test_add_reminder_shows_in_list_with_note(page: Page, base_url, errors):
    start_demo(page, base_url)
    dialog = add_reminder(page, "QA Streaming", note="Shared with Sam")
    expect(dialog).to_contain_text("QA Streaming")
    expect(dialog).to_contain_text("Shared with Sam")
    dialog.get_by_role("button", name="Go to my list").click()
    expect(row(page, "QA Streaming")).to_be_visible()
    expect(row(page, "QA Streaming")).to_contain_text("Shared with Sam")


def test_form_explains_missing_fields(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    page.locator("#f-amount").fill("abc")
    page.get_by_role("button", name="Save reminder").click()
    expect(page.get_by_text(re.compile("Add a name so you know what this is"))).to_be_visible()
    expect(page.get_by_text(re.compile("Add the next charge or expiry date"))).to_be_visible()
    expect(page.get_by_text("Use numbers only, like 9.99.").first).to_be_visible()
    expect(page).to_have_url(re.compile(r"#/new$"))  # nothing saved


def test_keep_it_then_undo(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Keep").get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Keep")
    drawer.get_by_role("button", name="Keep it").click()
    expect(page.get_by_role("button", name="Undo")).to_be_visible()
    page.get_by_role("button", name="Undo").click()
    drawer = page.get_by_role("dialog", name="QA Keep")  # undo reopens the details it came from
    expect(drawer).to_be_visible()
    expect(drawer.get_by_role("button", name="Keep it")).to_be_visible()


def test_decide_later_moves_to_unfinished(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Later", days=25).get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Later")
    drawer.get_by_role("button", name="Decide later").click()
    later = page.get_by_role("dialog", name="Decide later")
    later.locator('[role="radiogroup"] .chip').first.click()
    later.get_by_role("button", name="Save and remind me").click()
    expect(later).to_be_hidden()
    expect(find(page, "QA Later")).to_contain_text(re.compile("Postponed|Unfinished|Decide", re.I))
    page.get_by_placeholder(re.compile("Search", re.I)).first.fill("")
    page.locator(".badge-btn").first.click()  # "N need a decision" opens the Unfinished tab
    expect(page.locator(".rrow", has_text="QA Later")).to_be_visible()


def test_edit_reminder(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Edit").get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Edit")
    drawer.get_by_role("button", name="Edit").click()
    expect(page.get_by_role("heading", name="Edit QA Edit")).to_be_visible()
    page.locator("#f-name").fill("QA Edited")
    page.get_by_role("button", name="Save changes").click()
    expect(find(page, "QA Edited")).to_have_count(1)
    expect(find(page, "QA Edit")).to_have_count(1)  # only the renamed one; the old name is gone


def test_delete_asks_first_and_can_be_undone(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Delete").get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Delete")
    drawer.get_by_role("button", name="Delete").click()
    confirm = page.get_by_role("alertdialog")
    expect(confirm).to_contain_text("Delete the QA Delete reminder?")
    confirm.get_by_role("button", name="Delete reminder").click()
    expect(row(page, "QA Delete")).to_have_count(0)
    page.get_by_role("button", name="Undo").click()
    expect(page.get_by_role("dialog", name="QA Delete")).to_be_visible()  # restored, details reopened
    page.get_by_role("button", name="Close details").click()
    expect(find(page, "QA Delete")).to_have_count(1)


def test_reminders_survive_reload(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Reload").get_by_role("button", name="Go to my list").click()
    page.reload()
    expect(find(page, "QA Reload")).to_be_visible()


def test_search_finds_reminder(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Search Unique").get_by_role("button", name="Go to my list").click()
    expect(find(page, "QA Search Unique")).to_be_visible()
    expect(page.locator(".rrow")).to_have_count(1)


def test_phone_width_has_no_sideways_scroll(page: Page, base_url, errors):
    page.set_viewport_size({"width": 375, "height": 812})
    start_demo(page, base_url)
    for route in ("dashboard", "reminders", "new"):
        page.goto(base_url + "/#/" + route)
        page.wait_for_timeout(300)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 0, f"#{route} scrolls sideways by {overflow}px at 375px wide"
